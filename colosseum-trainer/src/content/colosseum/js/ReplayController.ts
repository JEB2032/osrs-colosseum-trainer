import { InputController, Random, ReplayLog, ReplayPlayback, Settings, Trainer, Viewport } from "osrs-sdk";
import type { ReplayEntry } from "osrs-sdk";

/** The parts of the SDK World a replay drives. */
type World = {
  globalTickCounter: number;
  getReadyTimer: number;
  tickWorld(): void;
  tickClient(tickPercent: number): void;
  startTicking(): void;
  stopTicking(): void;
};

import type { InvocationState } from "./Invocations";

/** Everything that decides how a wave plays out, other than the player's inputs. */
export type RunConfig = {
  wave: number;
  forceDoubleSouth: boolean;
  npcsAggressive: boolean;
  invocations: InvocationState;
};

export type Recording = {
  seed: number;
  config: RunConfig;
  entries: ReplayEntry[];
  /** Ticks since the run was reset when the recording ended (death, or when replay was requested). */
  endTick: number;
  died: boolean;
};

export const REPLAY_WINDOW_TICKS = 50; // 30 seconds
const CLIENT_TICKS_PER_GAME_TICK = 30;

/** mulberry32: a small, fast seeded PRNG so a run can be re-simulated exactly. */
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Mode = "live" | "replay";

/**
 * Records every run (RNG seed + player inputs per tick) and plays back the last 30 seconds by
 * re-simulating the run from its seed. Re-simulation keeps replays in full 3D and tick-exact.
 */
export class ReplayController {
  private mode: Mode = "live";
  private seed = 0;
  private config: RunConfig | null = null;
  private entries: ReplayEntry[] = [];
  private startTick = 0;
  private lastRecording: Recording | null = null;
  private replay: { recording: Recording; fromTick: number } | null = null;
  private replayTick = 0;
  private paused = false;
  private speed = 1;
  private listeners = new Set<() => void>();
  private snapshot = this.createSnapshot();

  constructor(private readonly getWorld: () => World) {}

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.snapshot;

  isReplaying() {
    return this.mode === "replay";
  }

  /** Ticks since the current run was reset. */
  runTick() {
    return this.getWorld().globalTickCounter - this.startTick;
  }

  /**
   * Called by the region on every reset. Returns the config the new run must use: the live
   * settings for a normal run, or the recorded config when a replay is being set up.
   */
  beginRun(liveConfig: RunConfig): RunConfig {
    const world = this.getWorld();
    this.startTick = world.globalTickCounter;
    if (this.mode === "replay" && this.replay) {
      const { recording } = this.replay;
      Random.setRandom(seededRandom(recording.seed));
      ReplayLog.setRecorder(null);
      InputController.controller.beforeTick = (tick) => {
        const relative = tick - this.startTick;
        this.replayTick = relative;
        recording.entries
          .filter((entry) => entry.tick === relative)
          .forEach((entry) => ReplayPlayback.apply(entry.action));
        if (relative >= recording.endTick + 3 && !this.paused) {
          // Hold on the death (or end) frame.
          this.setPaused(true);
        }
        this.emit();
      };
      return recording.config;
    }

    this.seed = Math.floor(Math.random() * 0xffffffff);
    this.config = liveConfig;
    this.entries = [];
    Random.setRandom(seededRandom(this.seed));
    InputController.controller.beforeTick = null;
    ReplayLog.setRecorder((action, timing) => {
      const relative = this.getWorld().globalTickCounter - this.startTick + (timing === "nextTick" ? 1 : 0);
      this.entries.push({ tick: relative, action });
    });
    this.lastRecording = null;
    this.emit();
    return liveConfig;
  }

  /** Called when the player dies in a live run. */
  playerDied() {
    if (this.mode !== "live") return;
    this.lastRecording = this.capture(true);
    this.emit();
  }

  /** The recording to replay: the death if there was one, otherwise the run so far. */
  private capture(died: boolean): Recording | null {
    if (!this.config) return null;
    return {
      seed: this.seed,
      config: this.config,
      entries: [...this.entries],
      endTick: this.getWorld().globalTickCounter - this.startTick,
      died,
    };
  }

  /** Start watching the last 30 seconds of the current or last run. */
  startReplay() {
    const recording = this.lastRecording ?? this.capture(false);
    if (!recording) return;
    this.lastRecording = recording;
    this.mode = "replay";
    this.replay = { recording, fromTick: Math.max(0, recording.endTick - REPLAY_WINDOW_TICKS) };
    this.seekTo(this.replay.fromTick, false);
  }

  /** Re-simulate the recording from its start up to `tick`, then pause or play from there. */
  seekTo(tick: number, paused = this.paused) {
    if (!this.replay) return;
    const world = this.getWorld();
    const target = Math.max(0, Math.min(tick, this.replay.recording.endTick + 3));
    const playsAudio = Settings.playsAudio;
    const playsAreaAudio = Settings.playsAreaAudio;
    Settings.playsAudio = false;
    Settings.playsAreaAudio = false;
    Trainer.reset();
    world.stopTicking();
    world.getReadyTimer = 0;
    while (world.globalTickCounter - this.startTick < target) this.stepSilently(world);
    Settings.playsAudio = playsAudio;
    Settings.playsAreaAudio = playsAreaAudio;
    this.replayTick = target;
    this.paused = paused;
    this.applySpeed();
    if (!paused) world.startTicking();
    else Viewport.viewport.draw(world as never);
    this.emit();
  }

  private stepSilently(world: World) {
    world.tickWorld();
    for (let i = 0; i < CLIENT_TICKS_PER_GAME_TICK; i++) world.tickClient(1);
  }

  setPaused(paused: boolean) {
    if (this.mode !== "replay") return;
    const world = this.getWorld();
    this.paused = paused;
    if (paused) world.stopTicking();
    else world.startTicking();
    this.emit();
  }

  /** Advance one game tick while paused. */
  step() {
    if (this.mode !== "replay" || !this.paused) return;
    const world = this.getWorld();
    this.stepSilently(world);
    Viewport.viewport.draw(world as never);
    this.emit();
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.applySpeed();
    this.emit();
  }

  private applySpeed() {
    Settings.tickMs = this.mode === "replay" ? Math.round(600 / this.speed) : 600;
  }

  /** Leave the replay and start a fresh run. */
  exitReplay() {
    this.mode = "live";
    this.replay = null;
    this.paused = false;
    InputController.controller.beforeTick = null;
    this.applySpeed();
    Trainer.reset();
    this.emit();
  }

  private emit() {
    this.snapshot = this.createSnapshot();
    this.listeners.forEach((listener) => listener());
  }

  private createSnapshot() {
    const replay = this.replay;
    return Object.freeze({
      mode: this.mode,
      paused: this.paused,
      speed: this.speed,
      hasDeath: this.lastRecording?.died === true,
      tick: this.replayTick,
      fromTick: replay?.fromTick ?? 0,
      endTick: replay?.recording.endTick ?? 0,
    });
  }
}
