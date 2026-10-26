"use strict";

/**
 * A serialisable description of one player input. Every input that changes game state is described
 * by one of these so a run can be re-simulated from its RNG seed, which is how death replays work.
 */
export type ReplayAction =
  | { kind: "walk"; x: number; y: number }
  | { kind: "attackMob"; mob: number }
  | { kind: "interrupt" }
  | { kind: "unequip"; slot: string }
  | { kind: "inventoryClick"; slot: number }
  | { kind: "swap"; a: number; b: number }
  | { kind: "prayer"; index: number }
  | { kind: "quickPrayers" }
  | { kind: "run" }
  | { kind: "spec" }
  | { kind: "attackStyle"; index: number }
  | { kind: "autoRetaliate" }
  | { kind: "custom"; name: string; data?: unknown };

export type ReplayEntry = { tick: number; action: ReplayAction };

type Recorder = (action: ReplayAction, timing: "thisTick" | "nextTick") => void;

export class ReplayLog {
  private static recorder: Recorder | null = null;
  static customHandlers: Record<string, (data: unknown) => void> = {};

  static setRecorder(recorder: Recorder | null) {
    ReplayLog.recorder = recorder;
  }

  /** An input applied by the queue flush at the start of the tick currently being processed. */
  static recordQueued(action: ReplayAction | null) {
    if (action) ReplayLog.recorder?.(action, "thisTick");
  }

  /** An input that changed state between ticks; it takes effect from the next tick. */
  static recordImmediate(action: ReplayAction) {
    ReplayLog.recorder?.(action, "nextTick");
  }

  static registerCustom(name: string, handler: (data: unknown) => void) {
    ReplayLog.customHandlers[name] = handler;
  }

  /** Index of a mob in the order a replay will see it at the same point in the same tick. */
  static mobIndex(mob: { region: { mobs: unknown[]; newMobs: unknown[] } }) {
    return [...mob.region.mobs, ...mob.region.newMobs].indexOf(mob);
  }
}
