import {
  cacheSound,
  DelayedAction,
  FixedLayout,
  Manticore,
  Player,
  Projectile,
  Random,
  ReplayLog,
  Settings,
  Sound,
  SoundCache,
  TileMarker,
  Viewport,
} from "osrs-sdk";
import type { Loadout, Mob, Unit } from "osrs-sdk";

import { colosseumLoadout } from "./ColosseumLoadout";
import { ColosseumRegion } from "./ColosseumRegion";
import { ColosseumScene } from "./ColosseumScene";
import { colosseumSettings } from "./ColosseumSettings";
import { COLOSSEUM_ASSETS } from "../../../assets";
import {
  FremennikWarbandArcher,
  FremennikWarbandBerserker,
  FremennikWarbandSeer,
  JavelinColossus,
  JaguarWarrior,
  LineOfSightPillar1x1,
  LineOfSightPillar3x3,
  Minotaur,
  MinotaurAnimations,
  SerpentShaman,
  ShockwaveColossus,
} from "./mobs";
import { withWaveSpawnPathing } from "./mobs/WaveSpawnPathing";
import { decodeLosWaveUrl, translateLosCoordinate, type LosMobSpec, type LosWaveImport } from "./LosWaveUrl";
import { SolarFlareOrb } from "./entities/SolarFlareOrb";
import { MoltenSand } from "./entities/MoltenSand";
import {
  VOLATILITY_EXTRA_TILES,
  VOLATILITY_MAX_HIT,
  BLASPHEMY_DRAIN_RATIO,
  DOOM_LETHAL_STACKS,
  FRAILTY_HP_REDUCTION,
  MYOPIA_RANGE_REDUCTION,
} from "./Invocations";
import { ReplayController, type RunConfig } from "./ReplayController";

const WaveSerpentShaman = withWaveSpawnPathing(SerpentShaman);
const WaveJavelinColossus = withWaveSpawnPathing(JavelinColossus);
const WaveJaguarWarrior = withWaveSpawnPathing(JaguarWarrior);
const WaveManticore = withWaveSpawnPathing(Manticore);
const WaveMinotaur = withWaveSpawnPathing(Minotaur);
const WaveShockwaveColossus = withWaveSpawnPathing(ShockwaveColossus);

export const WAVE_COMPOSITIONS = {
  1: { shaman: 1, javelin: 0, manticore: 0, shockwave: 0 },
  2: { shaman: 1, javelin: 1, manticore: 0, shockwave: 0 },
  3: { shaman: 1, javelin: 2, manticore: 0, shockwave: 0 },
  4: { shaman: 1, javelin: 0, manticore: 1, shockwave: 0 },
  5: { shaman: 1, javelin: 1, manticore: 1, shockwave: 0 },
  6: { shaman: 1, javelin: 2, manticore: 1, shockwave: 0 },
  7: { shaman: 0, javelin: 1, manticore: 1, shockwave: 1 },
  8: { shaman: 0, javelin: 2, manticore: 1, shockwave: 1 },
  9: { shaman: 0, javelin: 1, manticore: 2, shockwave: 0 },
  10: { shaman: 0, javelin: 2, manticore: 2, shockwave: 0 },
  11: { shaman: 0, javelin: 1, manticore: 2, shockwave: 1 },
} as const;

export type WaveNumber = keyof typeof WAVE_COMPOSITIONS;
export type ImportedReinforcements =
  | "none"
  | "jaguar"
  | "shaman-jaguar"
  | "minotaur"
  | "minotaur-shaman";

// Perimeter tiles derived from osrs-colosseum's blockedTileRanges. Only the
// inaccessible tiles bordering an accessible tile are retained. Coordinates
// are translated from the solver into this region by (+10, +9).
const EDGE_BLOCKER_X_BY_Y: ReadonlyArray<readonly [number, readonly number[]]> = [
  [9, [19, 20, 21, 22, 25, 26, 27, 28, 31, 32, 33, 34]],
  [10, [17, 18, 35, 36]],
  [11, [16, 37, 38]],
  [12, [15, 39]],
  [13, [13, 14, 39, 40]],
  [14, [12, 41]],
  [15, [12, 41]],
  [16, [11, 42]],
  [17, [11, 42]],
  [18, [10, 43]],
  [19, [10, 43]],
  [20, [10, 42]],
  [21, [10, 41]],
  [22, [41]],
  [23, [41]],
  [24, [10, 41]],
  [25, [10, 41]],
  [26, [10, 41]],
  [27, [10, 41]],
  [28, [41]],
  [29, [41]],
  [30, [10, 41]],
  [31, [10, 42]],
  [32, [10, 43]],
  [33, [10, 43]],
  [34, [11, 42]],
  [35, [11, 42]],
  [36, [12, 41]],
  [37, [12, 41]],
  [38, [13, 14, 39, 40]],
  [39, [14, 39]],
  [40, [15, 16, 37, 38]],
  [41, [17, 18, 35, 36]],
  [42, [19, 20, 21, 22, 25, 26, 27, 28, 31, 32, 33, 34]],
];

// osrs-colosseum relies on its canvas bounds behind these gate recesses. Put
// the closing tiles one step outside the visible inner edge so the notches are
// retained in this larger Region.
const OUTER_GATE_BLOCKERS = [
  { x: 23, y: 8 }, { x: 24, y: 8 },
  { x: 29, y: 8 }, { x: 30, y: 8 },
  { x: 23, y: 43 }, { x: 24, y: 43 },
  { x: 29, y: 43 }, { x: 30, y: 43 },
  { x: 9, y: 22 }, { x: 9, y: 23 },
  { x: 9, y: 28 }, { x: 9, y: 29 },
] as const;

export const COLOSSEUM_SPAWN_POINTS = [
  { x: 13, y: 28 },
  { x: 19, y: 26 },
  { x: 13, y: 23 },
  { x: 23, y: 23 },
  { x: 29, y: 23 },
  { x: 27, y: 18 },
  { x: 23, y: 29 },
  { x: 29, y: 29 },
  { x: 26, y: 33 },
  { x: 34, y: 25 },
  { x: 38, y: 23 },
  { x: 38, y: 28 },
] as const;

// The A/B method's tiles beside the north-west pillar (pillar occupies x 18-20, y 17-19), and the
// start tile five tiles south of it.
export const START_TILE = { x: 17, y: 24 } as const;
export const A_TILE = { x: 17, y: 17 } as const;
export const B_TILE = { x: 17, y: 18 } as const;

// Venom: 6 damage every 30 ticks, +2 per hit, capped at 20.
const VENOM_INTERVAL_TICKS = 30;
const VENOM_START_DAMAGE = 6;
const VENOM_MAX_DAMAGE = 20;

// spawns that lead to double souths
const SOUTH_SPAWN_1 = { x: 26, y: 33 } as const;
const SOUTH_SPAWN_2 = { x: 23, y: 29 } as const;
const REINFORCEMENT_DELAY_TICKS = 67;
const FREMENNIK_ARCHER_SPAWN_TOP_LEFT = { x: 22, y: 21 } as const;
const FREMENNIK_ARCHER_SPAWN_SIZE = 7;
const REINFORCEMENT_START_X = 25;
const NORTH_REINFORCEMENT_Y = 12;
// This is the scene-debug coordinate observed for the south reinforcement row.
const SOUTH_REINFORCEMENT_Y = 41;

function shuffle<T>(values: readonly T[]): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Random.get() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function isWithinTiles(first: { x: number; y: number }, second: { x: number; y: number }, distance: number) {
  return Math.max(Math.abs(first.x - second.x), Math.abs(first.y - second.y)) <= distance;
}

function sameLocation(first: { x: number; y: number }, second: { x: number; y: number }) {
  return first.x === second.x && first.y === second.y;
}

function npcOrder(mob: Mob) {
  if (mob instanceof Manticore) return 0;
  if (mob instanceof SerpentShaman) return 1;
  if (mob instanceof JavelinColossus) return 2;
  if (mob instanceof ShockwaveColossus) return 3;
  if (mob instanceof JaguarWarrior) return 4;
  if (mob instanceof Minotaur) return 5;
  return Number.MAX_SAFE_INTEGER;
}

/** Visual sandbox for the NPCs used by ordinary Colosseum waves. */
export class WavesRegion extends ColosseumRegion {
  private pendingMobs: Mob[] = [];
  private waveMobPool: Record<"shaman" | "javelin" | "manticore" | "shockwave", Mob[]> = {
    shaman: [], javelin: [], manticore: [], shockwave: [],
  };
  private selectedWave: WaveNumber;
  private fremennikWarbandPool: {
    archer: FremennikWarbandArcher;
    seer: FremennikWarbandSeer;
    berserker: FremennikWarbandBerserker;
  } | null = null;
  private reinforcementMobPool: { jaguar: Mob; minotaur: Mob; shaman: Mob } | null = null;
  private reinforcementTicks = 0;
  private reinforcementsSpawned = false;
  private wavePhase: "waiting" | "countdown" | "active" = "waiting";
  private waveStartRequested = false;
  private waveSpawnTicks = 0;
  private spawnEligibilityPlayerLocation: { x: number; y: number } | null = null;
  private waveStateListeners = new Set<() => void>();
  private waveTick = 0;
  private losWaveImport: LosWaveImport | null;
  private importedReinforcements: ImportedReinforcements = "none";
  private quartetPool: Mob[] = [];
  private runConfig: RunConfig;
  private doomStacks = 0;
  private venom: { damage: number; ticks: number } | null = null;

  /** Records every run and plays back deaths. */
  readonly replay = new ReplayController(() => this.world);

  constructor(loadouts: Loadout[] = [colosseumLoadout]) {
    super(loadouts);
    this.selectedWave = colosseumSettings.getSnapshot().waveNumber as WaveNumber;
    this.losWaveImport = decodeLosWaveUrl(new URL(window.location.href));
    ReplayLog.registerCustom("waveStart", () => {
      if (this.wavePhase === "waiting") this.waveStartRequested = true;
    });
    // Visual metronome: counts 1-5. Once NPCs are in, 1 is the tick they spawned on.
    FixedLayout.infoboxes = [() => {
      if (!colosseumSettings.getSnapshot().showMetronome) return null;
      const tick = this.wavePhase === "active" ? this.waveTick : this.replay.runTick();
      const count = (((tick % 5) + 5) % 5) + 1;
      return { text: String(count), active: count === 1 };
    }];
  }

  override getName() {
    return "Fortis Colosseum Waves";
  }

  override initialiseRegion() {
    const player = new Player(this, this.losWaveImport?.player
      ? translateLosCoordinate(this.losWaveImport.player)
      : { ...START_TILE });
    this.addPlayer(player);

    const mobOptions = {
      cooldown: 3,
    };
    this.waveMobPool = {
      shaman: Array.from({ length: 8 }, () => new WaveSerpentShaman(this, { x: 23, y: 30 }, mobOptions)),
      javelin: Array.from({ length: 8 }, () => new WaveJavelinColossus(this, { x: 20, y: 30 }, mobOptions)),
      manticore: Array.from({ length: 7 }, () => new WaveManticore(this, { x: 21, y: 24 }, mobOptions)),
      shockwave: Array.from({ length: 7 }, () => new WaveShockwaveColossus(this, { x: 29, y: 32 }, mobOptions)),
    };
    this.fremennikWarbandPool = {
      berserker: new FremennikWarbandBerserker(this, { x: 23, y: 20 }, { cooldown: 3 }),
      seer: new FremennikWarbandSeer(this, { x: 24, y: 21 }, { cooldown: 4 }),
      archer: new FremennikWarbandArcher(this, { x: 22, y: 21 }, { cooldown: 5 }),
    };
    this.reinforcementMobPool = {
      jaguar: new WaveJaguarWarrior(this, { x: 25, y: 12 }, mobOptions),
      minotaur: new WaveMinotaur(this, { x: 25, y: 12 }, mobOptions),
      shaman: new WaveSerpentShaman(this, { x: 25, y: 12 }, mobOptions),
    };
    // Quartet: one extra warbander of each kind is pooled; one of them is picked at spawn.
    this.quartetPool = [
      new FremennikWarbandBerserker(this, { x: 23, y: 20 }, { cooldown: 3 }),
      new FremennikWarbandArcher(this, { x: 22, y: 21 }, { cooldown: 5 }),
      new FremennikWarbandSeer(this, { x: 24, y: 21 }, { cooldown: 4 }),
    ];
    this.pendingMobs = [
      ...this.waveMobPool.shaman,
      ...this.waveMobPool.javelin,
      ...this.waveMobPool.manticore,
      ...this.waveMobPool.shockwave,
      ...Object.values(this.fremennikWarbandPool),
      ...Object.values(this.reinforcementMobPool),
      ...this.quartetPool,
    ];

    // A 3x3 NPC is anchored at its southwest tile, one tile southwest of
    // each pillar's centre coordinate.
    this.addEntity(new LineOfSightPillar3x3(this, { x: 18, y: 19 }));
    this.addEntity(new LineOfSightPillar3x3(this, { x: 33, y: 19 }));
    this.addEntity(new LineOfSightPillar3x3(this, { x: 18, y: 34 }));
    this.addEntity(new LineOfSightPillar3x3(this, { x: 33, y: 34 }));

    EDGE_BLOCKER_X_BY_Y.forEach(([y, xs]) => {
      xs.forEach((x) => this.addEntity(new LineOfSightPillar1x1(this, { x, y })));
    });
    OUTER_GATE_BLOCKERS.forEach((location) => {
      this.addEntity(new LineOfSightPillar1x1(this, { ...location }));
    });

    // osrs-colosseum's canonical B5 tile is [7, 15], translated by (+10, +9).
    this.addEntity(new TileMarker(this, { ...START_TILE }, "#00FF00", 1, false));
    this.addEntity(new TileMarker(this, { ...A_TILE }, "#00FFFF", 1, false));
    this.addEntity(new TileMarker(this, { ...B_TILE }, "#FF00FF", 1, false));

    // Solarflare: one orb on the 5x5 ring around each pillar (pillar SW anchors above).
    const solarflare = this.runConfig.invocations.solarflare;
    if (solarflare > 0) {
      [{ x: 18, y: 19 }, { x: 33, y: 19 }, { x: 18, y: 34 }, { x: 33, y: 34 }].forEach((pillar) => {
        this.addEntity(new SolarFlareOrb(this, { x: pillar.x - 1, y: pillar.y - 3 }, solarflare, 0));
      });
    }

    if (Settings.use3dView) {
      this.addEntity(new ColosseumScene(this, { x: 0, y: 0 }));
    }

    return { player };
  }

  override reset(startWorld = true) {
    // Seed the RNG (or restore a recorded seed for a replay) before anything random happens.
    const settings = colosseumSettings.getSnapshot();
    this.runConfig = this.replay.beginRun({
      wave: this.selectedWave,
      forceDoubleSouth: settings.forceDoubleSouth,
      npcsAggressive: settings.npcsAggressive,
      invocations: settings.invocations,
    });
    this.selectedWave = this.runConfig.wave as WaveNumber;
    this.doomStacks = 0;
    this.venom = null;
    this.quartetPool = [];
    this.wavePhase = "waiting";
    this.waveStartRequested = false;
    this.waveSpawnTicks = 0;
    this.spawnEligibilityPlayerLocation = null;
    this.reinforcementMobPool = null;
    this.fremennikWarbandPool = null;
    this.reinforcementTicks = 0;
    this.reinforcementsSpawned = false;
    this.waveTick = 0;
    this.pendingMobs = [];
    const reset = super.reset(false);
    // The modal owns the wave-start gate. Keep the world live so the player
    // can move during the five ticks between modal close and NPC placement.
    this.world.getReadyTimer = 0;
    reset.player.frozen = 2;
    this.applyInvocationsToPlayer(reset.player);
    Manticore.showAttackTimer = settings.showManticoreTimer;
    FixedLayout.chatMessages = [];
    FixedLayout.addChatMessage(`Wave: ${this.selectedWave}`, "#7f0000");
    Viewport.viewport.rotateEast();
    this.notifyWaveStateChanged();
    if (startWorld) this.world.startTicking();
    return reset;
  }

  requestWaveStart() {
    if (this.wavePhase !== "waiting" || this.replay.isReplaying()) return;
    this.waveStartRequested = true;
    ReplayLog.recordImmediate({ kind: "custom", name: "waveStart" });
  }

  readonly getDoomStacks = () => this.doomStacks;

  private applyInvocationsToPlayer(player: Player) {
    const { invocations } = this.runConfig;
    Manticore.mayhemLevel = invocations.mantimayhem;
    player.attackRangeModifier = -MYOPIA_RANGE_REDUCTION[invocations.myopia];
    if (invocations.frailty > 0) {
      // player.stats is shared with the saved Settings.player_stats; copy before changing it.
      player.stats = { ...player.stats };
      const base = player.stats.hitpoint;
      const hitpoints = base - Math.floor(base * FRAILTY_HP_REDUCTION[invocations.frailty]);
      player.stats.hitpoint = hitpoints;
      player.currentStats.hitpoint = hitpoints;
    }
  }

  override onIncomingHit(unit: Unit, projectile: Projectile) {
    const player = this.players[0];
    if (unit !== player || projectile.from === player) return;
    const { invocations } = this.runConfig;
    const damage = Math.max(0, projectile.damage);

    if (invocations.blasphemy > 0 && damage > 0) {
      const drain = Math.floor(damage * BLASPHEMY_DRAIN_RATIO[invocations.blasphemy]);
      player.currentStats.prayer = Math.max(0, player.currentStats.prayer - drain);
    }

    if (invocations.doom > 0 && damage > 0) {
      this.doomStacks++;
      if (this.doomStacks >= DOOM_LETHAL_STACKS[invocations.doom]) {
        FixedLayout.addChatMessage("The weight of doom crushes you.", "#ff0000");
        player.currentStats.hitpoint = 0;
      }
      this.notifyWaveStateChanged();
    }

    // Mantimayhem II: unprotected manticore hits inflict venom.
    if (
      invocations.mantimayhem >= 2 &&
      projectile.from instanceof Manticore &&
      !projectile.weapon?.isBlockable(projectile.from, player, { attackStyle: projectile.attackStyle })
    ) {
      if (!this.venom) {
        this.venom = { damage: VENOM_START_DAMAGE, ticks: VENOM_INTERVAL_TICKS };
        FixedLayout.addChatMessage("You have been envenomed!", "#007f00");
      }
    }
  }

  override onUnitDeath(unit: Unit) {
    if (unit !== this.players[0]) {
      this.explodeOnDeath(unit);
      return;
    }
    FixedLayout.addChatMessage("Oh dear, you are dead!", "#000000");
    this.replay.playerDied();
  }

  /** Volatility: a square explosion one or two tiles beyond the NPC, when its death animation ends. */
  private explodeOnDeath(unit: Unit) {
    const tier = this.runConfig.invocations.volatility;
    if (tier === 0 || !(unit as Mob).mobName) return;
    const extra = VOLATILITY_EXTRA_TILES[tier];
    const size = unit.size + extra * 2;
    // Units are anchored on their south-west tile; the area extends `extra` beyond each side.
    const anchor = { x: unit.location.x - extra, y: unit.location.y + extra };
    const centre = { x: unit.location.x + Math.floor(unit.size / 2), y: unit.location.y - Math.floor(unit.size / 2) };
    const marker = new TileMarker(this, { ...anchor }, "#FF8000", size, false);
    this.addEntity(marker);
    DelayedAction.registerDelayedNpcAction(new DelayedAction(() => {
      this.removeEntity(marker);
      const player = this.players[0];
      if (player && player.dying < 0) {
        const { x, y } = player.location;
        if (x >= anchor.x && x < anchor.x + size && y <= anchor.y && y > anchor.y - size) {
          const damage = Math.floor(Random.get() * (VOLATILITY_MAX_HIT + 1));
          player.addProjectile(new Projectile(null, damage, player, player, "typeless", { setDelay: 0 }));
        }
      }
      if (tier >= 3) this.addEntity(new MoltenSand(this, centre));
    }, Math.max(1, unit.deathAnimationLength)));
  }

  private tickInvocations() {
    const player = this.players[0];
    if (!player || player.dying >= 0) return;
    if (this.runConfig.invocations.frailty > 0 && player.currentStats.hitpoint > player.stats.hitpoint) {
      // Frailty disables overhealing.
      player.currentStats.hitpoint = player.stats.hitpoint;
    }
    if (this.venom && --this.venom.ticks <= 0) {
      const damage = this.venom.damage;
      player.addProjectile(new Projectile(null, damage, player, player, "typeless", { setDelay: 0 }));
      this.venom = { damage: Math.min(VENOM_MAX_DAMAGE, damage + 2), ticks: VENOM_INTERVAL_TICKS };
    }
  }

  readonly isLosWaveImport = () => this.losWaveImport !== null;

  readonly subscribeWaveState = (listener: () => void) => {
    this.waveStateListeners.add(listener);
    return () => this.waveStateListeners.delete(listener);
  };

  readonly isWaveStartModalOpen = () => this.wavePhase === "waiting";

  readonly getSelectedWave = () => this.selectedWave;

  readonly getWaveTick = () => this.waveTick;

  readonly getImportedReinforcements = () => this.importedReinforcements;

  importLosWave(imported: LosWaveImport) {
    this.losWaveImport = imported;
    this.importedReinforcements = "none";
    this.reset();
  }

  setImportedReinforcements(reinforcements: ImportedReinforcements) {
    if (this.wavePhase !== "waiting" || !this.losWaveImport) return;
    this.importedReinforcements = reinforcements;
    this.notifyWaveStateChanged();
  }

  setSelectedWave(wave: WaveNumber) {
    if (this.wavePhase !== "waiting" || wave === this.selectedWave) return;
    this.selectedWave = wave;
    colosseumSettings.set({ waveNumber: wave });
    this.notifyWaveStateChanged();
  }

  override postTick() {
    this.tickInvocations();
    if (this.wavePhase === "waiting" && this.waveStartRequested) {
      const countdown = () => {
        // postTick is a server-tick boundary: close the modal here, then count
        // five complete ticks before placing the NPCs into the Region.
        this.wavePhase = "countdown";
        this.waveStartRequested = false;
        this.waveSpawnTicks = 5;
        SoundCache.play(new Sound(cacheSound(COLOSSEUM_ASSETS.sounds.waveStartAcknowledged.id), 0.1));
        this.notifyWaveStateChanged();
      };
      if (this.losWaveImport) {
        this.waveStartRequested = false;
        if (this.losWaveImport.fromWaveStart) {
          // delayed start
          countdown();
          return;
        }
        // instant start
        this.waveSpawnTicks = 0;
        this.wavePhase = "countdown";
        this.notifyWaveStateChanged();
        return;
      }
      countdown();
      return;
    }

    if (this.wavePhase === "waiting") {
      // Player movement is processed before postTick. Refreshing a one-tick
      // freeze here holds them until the server acknowledges Start, without
      // pausing the world or preventing camera input.
      this.players[0].freeze(2);
      return;
    }

    if (this.wavePhase === "active") {
      if (!this.reinforcementsSpawned && --this.reinforcementTicks <= 0) {
        this.spawnReinforcements();
      }
      this.waveTick++;
      this.notifyWaveStateChanged();
      return;
    }

    if (this.wavePhase !== "countdown") return;
    this.waveSpawnTicks--;
    if (this.waveSpawnTicks === 1) {
      this.spawnEligibilityPlayerLocation = { ...this.players[0].location };
    }
    if (this.waveSpawnTicks > 0) return;

    const player = this.players[0];
    const aggressive = this.runConfig.npcsAggressive;

    if (this.losWaveImport) {
      // short circuit for LOS import
      this.spawnLosWave(this.players[0], this.losWaveImport);
      return;
    }

    const composition = WAVE_COMPOSITIONS[this.selectedWave];
    const shockwaves = composition.shockwave * (this.runConfig.invocations.dynamicDuo ? 2 : 1);
    const waveMobs = [
      ...this.waveMobPool.shaman.slice(0, composition.shaman),
      ...this.waveMobPool.javelin.slice(0, composition.javelin),
      ...this.waveMobPool.manticore.slice(0, composition.manticore),
      ...this.waveMobPool.shockwave.slice(0, shockwaves),
    ];

    const randomizedMobs = shuffle(waveMobs);
    const eligibilityPlayerLocation = this.spawnEligibilityPlayerLocation ?? player.location;
    const eligibleSpawns = COLOSSEUM_SPAWN_POINTS.filter(
      (spawn) => !isWithinTiles(spawn, eligibilityPlayerLocation, 4),
    );
    const forceDoubleSouth = this.runConfig.forceDoubleSouth;
    const forcedSpawns = forceDoubleSouth
      ? [SOUTH_SPAWN_1, SOUTH_SPAWN_2].slice(0, randomizedMobs.length)
      : [];
    const remainingSpawns = shuffle(eligibleSpawns.filter(
      (spawn) => !forcedSpawns.some((forced) => sameLocation(spawn, forced)),
    ));
    const allocatedSpawns = [...forcedSpawns, ...remainingSpawns];
    if (allocatedSpawns.length < randomizedMobs.length) {
      throw new Error("Not enough eligible Colosseum spawn points for this wave");
    }

    randomizedMobs.forEach((mob, index) => mob.setLocation(allocatedSpawns[index]));

    // NPC_INFO.id in osrs-colosseum defines server processing order. Location
    // allocation is random, but insertion into the Region must retain it.
    randomizedMobs.sort((first, second) => npcOrder(first) - npcOrder(second));
    this.spawnFremennikWarband(player, aggressive);
    randomizedMobs.forEach((mob) => {
      if (aggressive) mob.setAggro(player);
      this.addMob(mob);
    });
    this.pendingMobs = [];
    this.spawnEligibilityPlayerLocation = null;
    this.wavePhase = "active";
    this.reinforcementTicks = REINFORCEMENT_DELAY_TICKS;
  }

  override async preload() {
    await Promise.all([
      super.preload(),
      ...this.pendingMobs.map((mob) => mob.preload()),
    ]);
  }

  private notifyWaveStateChanged() {
    this.waveStateListeners.forEach((listener) => listener());
  }

  private spawnReinforcements() {
    const pool = this.reinforcementMobPool;
    if (!pool) return;
    if (!this.players[0]) {
      // The player died before reinforcements were due.
      this.reinforcementsSpawned = true;
      return;
    }

    let reinforcements: Mob[];
    if (this.losWaveImport) {
      switch (this.importedReinforcements) {
        case "jaguar": reinforcements = [pool.jaguar]; break;
        case "shaman-jaguar": reinforcements = [pool.shaman, pool.jaguar]; break;
        case "minotaur": reinforcements = [pool.minotaur]; break;
        case "minotaur-shaman": reinforcements = [pool.minotaur, pool.shaman]; break;
        default:
          this.reinforcementsSpawned = true;
          return;
      }
    } else if (this.selectedWave <= 3) reinforcements = [pool.jaguar];
    else if (this.selectedWave <= 6) reinforcements = [pool.shaman, pool.jaguar];
    else if (this.selectedWave <= 9) reinforcements = [pool.minotaur];
    else reinforcements = [pool.minotaur, pool.shaman];

    reinforcements = shuffle(reinforcements);
    const player = this.players[0];
    const y = player.location.y <= 27 ? NORTH_REINFORCEMENT_Y : SOUTH_REINFORCEMENT_Y;
    let x = REINFORCEMENT_START_X;
    reinforcements.forEach((mob) => {
      mob.setLocation({ x, y });
      x += mob.size;
    });

    // Preserve the randomized left-to-right allocation while restoring the
    // Colosseum's canonical NPC processing order for insertion.
    reinforcements.sort((first, second) => npcOrder(first) - npcOrder(second));
    const aggressive = this.runConfig.npcsAggressive;
    reinforcements.forEach((mob) => {
      if (aggressive) mob.setAggro(player);
      this.addMob(mob);
      if (mob instanceof Minotaur) mob.playAnimation(MinotaurAnimations.Spawn);
    });
    this.reinforcementsSpawned = true;
  }

  private spawnFremennikWarband(player: Player, aggressive: boolean) {
    const pool = this.fremennikWarbandPool;
    if (!pool) return;

    const archerLocation = {
      x: FREMENNIK_ARCHER_SPAWN_TOP_LEFT.x + Math.floor(Random.get() * FREMENNIK_ARCHER_SPAWN_SIZE),
      y: FREMENNIK_ARCHER_SPAWN_TOP_LEFT.y + Math.floor(Random.get() * FREMENNIK_ARCHER_SPAWN_SIZE),
    };
    pool.archer.setLocation(archerLocation);
    pool.seer.setLocation({ x: archerLocation.x + 2, y: archerLocation.y });
    pool.berserker.setLocation({ x: archerLocation.x + 1, y: archerLocation.y - 1 });

    // This is also their observed server-index order. Their attack phases are
    // independently fixed at spawn +3, +4 and +5 ticks.
    const warband: Mob[] = [pool.berserker, pool.archer, pool.seer];
    if (this.runConfig.invocations.quartet && this.quartetPool.length) {
      const extra = this.quartetPool[Math.floor(Random.get() * this.quartetPool.length)];
      extra.setLocation({ x: archerLocation.x + 1, y: archerLocation.y + 1 });
      warband.push(extra);
    }
    warband.forEach((mob) => {
      if (aggressive) mob.setAggro(player);
      this.addMob(mob);
    });
  }

  private spawnLosWave(player: Player, imported: LosWaveImport) {
    const waveMobs = imported.mobs.map((spec) => this.createLosMob(spec, imported.fromWaveStart));
    waveMobs.forEach((mob) => {
      mob.setLocation(translateLosCoordinate({ x: mob.location.x, y: mob.location.y }));
      mob.setAggro(player);
      this.addMob(mob);
    });
    this.wavePhase = "active";
    const spawnImportedReinforcements = this.importedReinforcements !== "none";
    this.reinforcementsSpawned = !spawnImportedReinforcements;
    this.reinforcementTicks = spawnImportedReinforcements ? REINFORCEMENT_DELAY_TICKS : 0;
    if (imported.fromWaveStart) this.spawnFremennikWarband(player, true);
  }

  private createLosMob(spec: LosMobSpec, fromWaveStart: boolean): Mob {
    const location = { x: spec.x, y: spec.y };
    const options = { cooldown: fromWaveStart ? 3 : 0 };
    let mob: Mob;
    switch (spec.type) {
      case 1: mob = fromWaveStart ? new WaveSerpentShaman(this, location, options) : new SerpentShaman(this, location, options); break;
      case 2: mob = fromWaveStart ? new WaveJavelinColossus(this, location, options) : new JavelinColossus(this, location, options); break;
      case 3: mob = fromWaveStart ? new WaveJaguarWarrior(this, location, options) : new JaguarWarrior(this, location, options); break;
      case 4: mob = fromWaveStart ? new WaveManticore(this, location, options) : new Manticore(this, location, options); break;
      case 5: mob = fromWaveStart ? new WaveMinotaur(this, location, options) : new Minotaur(this, location, options); break;
      case 6: mob = fromWaveStart ? new WaveShockwaveColossus(this, location, options) : new ShockwaveColossus(this, location, options); break;
      case 7: mob = fromWaveStart ? new WaveSerpentShaman(this, location, options) : new SerpentShaman(this, location, options); break;
      default: throw new Error(`Unknown LOS NPC type: ${spec.type}`);
    }
    if (mob instanceof Manticore && spec.extra) mob.setAttackPattern(spec.extra);
    return mob;
  }
}
