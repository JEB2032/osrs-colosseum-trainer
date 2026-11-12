import {
  CardinalDirection,
  FixedLayout,
  GraphicsObject,
  ImageLoader,
  MagicWeapon,
  MeleeWeapon,
  Player,
  Projectile,
  Random,
  RangedWeapon,
  Region,
  ReplayLog,
  Viewport,
} from "osrs-sdk";
import type { Loadout, Unit, Weapon } from "osrs-sdk";

import { ReplayController, type RunConfig } from "../colosseum/js/ReplayController";
import { DEFAULT_INVOCATIONS } from "../colosseum/js/Invocations";
import { MAGGOT_ASSETS } from "../../maggotAssets";
import {
  ATTACK_SPEED_AFTER_SCREECH,
  ATTACK_SPEED_INITIAL,
  ATTACKS_BETWEEN_SCREECH,
  BURN_DAMAGE,
  BURN_MAX_STACKS,
  CARRION_FALL_TICKS,
  CARRION_MAX_HIT,
  CARRION_PILES,
  CARRION_SPLATTER_MAX_HIT,
  CARRION_SPLATTER_TICKS,
  ENRAGE_THRESHOLD,
  KING_HITPOINTS,
  KING_LEVELS,
  LARVA_CHIP_START,
  LARVA_FLIGHT_TICKS,
  LARVAE_THRESHOLD,
  MELEE_THRESHOLD,
  MULTI_LARVAE_THRESHOLD,
  POISON_BILE_DAMAGE,
  PROJECTILE_MAX_HIT,
  PUNISH_DAMAGE,
  RANGED_POISON_START,
  SCREECH_DAMAGE,
  SCREECH_DEFENCE,
  SCREECH_TICKS,
  SLAM_MAX_HIT,
  SLAM_PROTECTED_MAX_HIT,
  SLAM_WINDUP_TICKS,
  STICKY_BILE_DAMAGE,
} from "./MaggotConfig";
import { Bile, BileKind, Carrion, CarrionShadow, LairBlocker, MaggotScene, SlamMarker } from "./MaggotEntities";
import { KingAnimations, MaggotKing, UrMaggotLarva } from "./MaggotMobs";

type Tile = { x: number; y: number };
type Style = "range" | "magic";
type Phase = "waiting" | "countdown" | "fight" | "dead";
/** What the king is doing between screeches. */
type Mode = "distance" | "melee";

// Trainer coordinates (cache tiles mirrored north-south: y = 63 - cacheY).
// Player strip: cache x 24-38, y 33-36 -> 15 x 4, rows 27 (against the bone wall) to 30 (back row).
const STRIP = { minX: 24, maxX: 38, minY: 27, maxY: 30 };
const BONE_WALL_Y = 26;
/** The king's 5x5 footprint is x..x+4, y-4..y. At the wall its front row is the bone wall. */
const KING_WALL_Y = 26;
const KING_BACK_Y = 23;
const KING_MIN_X = 24;
const KING_MAX_X = 34;
const KING_SPAWN = { x: 29, y: KING_BACK_Y };
const PLAYER_START = { x: 31, y: 30 };
const BURN_STACK_TICKS = 40; // assumed (like other burns: 40 ticks)
const POISON_INTERVAL = 30;
const CARRION_LIFETIME_TICKS = 40; // assumed

const BLANK_MAP = (() => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 4;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#101208";
    context.fillRect(0, 0, 4, 4);
  }
  return canvas.toDataURL();
})();

const SPOT = MAGGOT_ASSETS.spotAnims;
const PROJECTILE_SPOTANIMS: Record<Style, number> = {
  range: SPOT.poisonProjectile.id,
  magic: SPOT.venatorProjectile.id,
};

/** Weapons used only to carry the king's projectiles and decide which prayer blocks them. */
const STYLE_WEAPONS: Record<Style | "melee", Weapon> = {
  range: new RangedWeapon(),
  magic: new MagicWeapon(),
  melee: new MeleeWeapon(),
};

const PROTECT_PRAYERS = ["Protect from Magic", "Protect from Range", "Protect from Melee"];

function inStrip(tile: Tile) {
  return tile.x >= STRIP.minX && tile.x <= STRIP.maxX && tile.y >= STRIP.minY && tile.y <= STRIP.maxY;
}

function sameTile(a: Tile, b: Tile) {
  return a.x === b.x && a.y === b.y;
}

function randomInt(min: number, max: number) {
  return min + Math.floor(Random.get() * (max - min + 1));
}

function isFireSpell(weapon: unknown) {
  return !!(weapon as { isFireSpell?: boolean } | null)?.isFireSpell;
}

export type MaggotSnapshot = {
  phase: Phase;
  ticks: number;
  kingHp: number;
  mode: Mode;
  style: Style;
  screeching: boolean;
  enraged: boolean;
  burnStacks: number;
  larvae: number;
  larvaeFlying: number;
  slamIncoming: boolean;
  atWall: boolean;
  poison: number;
  punishes: number;
  punishesMissed: number;
};

/** The Maggot King: its lair, attack rotation and hazards. */
export class MaggotRegion extends Region {
  readonly replay = new ReplayController(() => this.world);
  mapImage: HTMLImageElement = ImageLoader.createImage(BLANK_MAP);

  private runConfig: RunConfig;
  private king: MaggotKing | null = null;
  private phase: Phase = "waiting";
  private startRequested = false;
  private countdown = 0;
  private fightTicks = 0;
  private attackTimer = 0;
  private attackSpeed = ATTACK_SPEED_INITIAL;
  private attacksLeft = 0;
  private style: Style = "range";
  private mode: Mode = "distance";
  private screechTicks = 0;
  private slam: { at: number; centreX: number; markers: SlamMarker[] } | null = null;
  private larvaWest = true;
  private burnExpiries: number[] = [];
  private poisonDamage = 0;
  private poisonTimer = 0;
  private poisonHits = 0;
  private punishes = 0;
  private punishesMissed = 0;
  private scheduled: { at: number; run: () => void }[] = [];
  private listeners = new Set<() => void>();
  private snapshot: MaggotSnapshot = this.makeSnapshot();

  constructor(loadouts: Loadout[] = []) {
    super(loadouts);
    ReplayLog.registerCustom("maggotStart", () => {
      if (this.phase === "waiting") this.startRequested = true;
    });
  }

  getName() {
    return "Maggot King";
  }

  get width() {
    return 64;
  }

  get height() {
    return 64;
  }

  get initialFacing() {
    return CardinalDirection.NORTH;
  }

  rightClickActions(): unknown[] {
    return [];
  }

  drawWorldBackground(context: OffscreenCanvasRenderingContext2D) {
    context.fillStyle = "#101208";
    context.fillRect(0, 0, 10000000, 10000000);
  }

  // --- UI state ---------------------------------------------------------------------------

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.snapshot;

  private get enraged() {
    return !!this.king && this.king.currentStats.hitpoint <= ENRAGE_THRESHOLD;
  }

  private makeSnapshot(): MaggotSnapshot {
    const larvae = this.mobs.filter((mob): mob is UrMaggotLarva => mob instanceof UrMaggotLarva && mob.dying < 0);
    return Object.freeze({
      phase: this.phase,
      ticks: this.fightTicks,
      kingHp: this.king?.currentStats.hitpoint ?? KING_HITPOINTS,
      mode: this.mode,
      style: this.style,
      screeching: this.screechTicks > 0,
      enraged: this.enraged,
      burnStacks: this.king?.burnStacks ?? 0,
      larvae: larvae.length,
      larvaeFlying: larvae.filter((larva) => larva.flying).length,
      slamIncoming: !!this.slam,
      atWall: !!this.king && this.king.location.y === KING_WALL_Y,
      poison: this.poisonDamage,
      punishes: this.punishes,
      punishesMissed: this.punishesMissed,
    });
  }

  private notify() {
    this.snapshot = this.makeSnapshot();
    this.listeners.forEach((listener) => listener());
  }

  requestStart() {
    if (this.phase !== "waiting" || this.replay.isReplaying()) return;
    this.startRequested = true;
    ReplayLog.recordImmediate({ kind: "custom", name: "maggotStart" });
  }

  // --- setup ------------------------------------------------------------------------------

  initialiseRegion() {
    const player = new Player(this, { ...PLAYER_START });
    this.addPlayer(player);
    // Bone wall: blocks movement only, so both sides can shoot over it.
    for (let x = STRIP.minX - 1; x <= STRIP.maxX + 1; x++) {
      this.addEntity(new LairBlocker(this, { x, y: BONE_WALL_Y }, false));
      this.addEntity(new LairBlocker(this, { x, y: STRIP.maxY + 1 }, true));
    }
    for (let y = STRIP.minY; y <= STRIP.maxY; y++) {
      this.addEntity(new LairBlocker(this, { x: STRIP.minX - 1, y }, true));
      this.addEntity(new LairBlocker(this, { x: STRIP.maxX + 1, y }, true));
    }
    this.addEntity(new MaggotScene(this));
    return { player };
  }

  override reset(startWorld = true) {
    this.runConfig = this.replay.beginRun({
      wave: 1,
      forceDoubleSouth: false,
      npcsAggressive: true,
      invocations: DEFAULT_INVOCATIONS,
      autoPray: false,
      autoMove: false,
      autoFight: false,
    });
    this.king = null;
    this.phase = "waiting";
    this.startRequested = false;
    this.fightTicks = 0;
    this.attackTimer = 0;
    this.attackSpeed = ATTACK_SPEED_INITIAL;
    this.attacksLeft = 0;
    this.style = "range";
    this.mode = "distance";
    this.screechTicks = 0;
    this.slam = null;
    this.larvaWest = true;
    this.burnExpiries = [];
    this.poisonDamage = 0;
    this.poisonTimer = 0;
    this.poisonHits = 0;
    this.punishes = 0;
    this.punishesMissed = 0;
    this.scheduled = [];
    const reset = super.reset(false);
    this.world.getReadyTimer = 0;
    reset.player.frozen = 2;
    FixedLayout.chatMessages = [];
    FixedLayout.addChatMessage("You enter the Maggot King's lair.", "#7f0000");
    Viewport.viewport.rotateNorth();
    // The king sits ~10 tiles north behind the bone wall; start zoomed out to see it.
    Viewport.viewport.setZoomOffset(3);
    this.notify();
    if (startWorld) this.world.startTicking();
    return reset;
  }

  /** Fetch the king and larva models up front so spawns don't pop in. */
  override async preload() {
    await Promise.all([
      super.preload(),
      new MaggotKing(this, { ...KING_SPAWN }).preload(),
      new UrMaggotLarva(this, { x: 0, y: 0 }).preload(),
    ]);
  }

  private spawnKing() {
    const king = new MaggotKing(this, { ...KING_SPAWN }, { aggro: this.players[0] });
    king.setStats();
    this.addMob(king);
    this.setBoss(king);
    this.king = king;
    this.attackTimer = 4;
    this.attacksLeft = randomInt(ATTACKS_BETWEEN_SCREECH.min, ATTACKS_BETWEEN_SCREECH.max);
  }

  // --- scheduling ---------------------------------------------------------------------------

  private schedule(delay: number, run: () => void) {
    this.scheduled.push({ at: this.fightTicks + Math.max(1, delay), run });
  }

  private runScheduled() {
    const due = this.scheduled.filter((event) => event.at <= this.fightTicks);
    this.scheduled = this.scheduled.filter((event) => event.at > this.fightTicks);
    due.forEach((event) => event.run());
  }

  /** One-shot cache spot animation on a tile (visual only). */
  private graphic(tile: Tile, id: number, height = 0) {
    this.addEntity(new GraphicsObject(this, { x: tile.x, y: tile.y }, id, { height }));
  }

  // --- main loop ----------------------------------------------------------------------------

  override postTick() {
    const player = this.players[0];
    if (this.phase === "waiting") {
      if (this.startRequested) {
        this.phase = "countdown";
        this.countdown = 2;
      }
      this.notify();
      return;
    }
    if (this.phase === "countdown") {
      if (--this.countdown <= 0) {
        this.spawnKing();
        this.phase = "fight";
        FixedLayout.addChatMessage("The Maggot King screeches at you!", "#7f0000");
      }
      this.notify();
      return;
    }
    if (this.phase === "dead" || !player || player.dying >= 0 || !this.king) {
      this.notify();
      return;
    }

    this.fightTicks++;
    this.runScheduled();
    this.tickBurns();
    this.tickPoison(player);
    this.tickBile(player);
    this.tickLarvae(player);
    this.tickSlam(player);
    this.tickKingMovement(player);
    this.tickAttacks(player);
    this.notify();
  }

  // --- rotation ----------------------------------------------------------------------------

  private tickAttacks(player: Player) {
    const king = this.king!;
    if (this.screechTicks > 0) {
      this.screechTicks--;
      if (this.screechTicks === 0) this.endScreech();
      return;
    }
    if (--this.attackTimer > 0) return;

    if (this.attacksLeft <= 0) {
      this.screech(player);
      return;
    }
    if (this.mode === "melee") {
      // Slams only from the wall, lined up with the player.
      if (king.location.y !== KING_WALL_Y || king.location.x !== this.wallX(player) || this.slam) {
        this.attackTimer = 1;
        return;
      }
      this.startSlam(player);
    } else {
      if (king.location.y !== KING_BACK_Y) {
        this.attackTimer = 1;
        return;
      }
      this.projectileAttack(player, this.style);
    }
    this.attacksLeft--;
    this.attackTimer = this.attackSpeed;
  }

  /** Green (ranged) or yellow (magic) spit: up to 46, leaves bile on your tile and two beside it. */
  private projectileAttack(player: Player, style: Style) {
    const king = this.king!;
    king.playAnimation(style === "range" ? KingAnimations.Range : KingAnimations.Magic);
    const weapon = STYLE_WEAPONS[style];
    weapon.damage = randomInt(0, PROJECTILE_MAX_HIT);
    const travel = 2;
    weapon.registerProjectile(king, player, { attackStyle: style }, {
      setDelay: travel,
      visuals: { spotAnim: { id: PROJECTILE_SPOTANIMS[style] }, endCycleOffset: travel * 30 },
    });
    this.schedule(travel, () => {
      const target = this.players[0];
      if (!target || target.dying >= 0) return;
      this.splashBile(target.location, style === "range" ? "poison" : "sticky", 2);
      if (style === "range" && this.poisonDamage === 0) {
        this.poisonDamage = RANGED_POISON_START;
        this.poisonTimer = POISON_INTERVAL;
        this.poisonHits = 0;
        FixedLayout.addChatMessage("You have been poisoned!", "#007f00");
      }
    });
  }

  /** Bile on the tile and `extra` random neighbouring tiles in the strip. */
  private splashBile(centre: Tile, kind: BileKind, extra: number) {
    const tiles: Tile[] = [{ ...centre }];
    const neighbours = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
      .map((d) => ({ x: centre.x + d.x, y: centre.y + d.y }))
      .filter(inStrip);
    while (tiles.length < 1 + extra && neighbours.length) {
      tiles.push(neighbours.splice(Math.floor(Random.get() * neighbours.length), 1)[0]);
    }
    tiles.filter(inStrip).forEach((tile) => this.placeBile(tile, kind));
  }

  private placeBile(tile: Tile, kind: BileKind) {
    this.entities.filter((entity) => (entity instanceof Bile || entity instanceof Carrion) && sameTile(entity.location, tile))
      .forEach((entity) => this.removeEntity(entity));
    this.addEntity(new Bile(this, { ...tile }, kind));
  }

  // --- screech, carrion and larvae ------------------------------------------------------------

  private screech(player: Player) {
    const king = this.king!;
    this.screechTicks = SCREECH_TICKS;
    king.playAnimation(KingAnimations.Screech);
    king.addSpotAnim({ id: SPOT.screechA.id, channel: "screech" });
    king.currentStats.defence = SCREECH_DEFENCE;
    const harmless = this.enraged;
    if (!harmless) {
      FixedLayout.addChatMessage("The Maggot King screeches! Turn your protection prayer off!", "#ffffff");
    }
    for (let tick = 1; tick <= SCREECH_TICKS; tick++) {
      this.schedule(tick, () => {
        const target = this.players[0];
        if (harmless || !target || target.dying >= 0) return;
        const praying = PROTECT_PRAYERS.some((name) => target.prayerController.findPrayerByName(name)?.isActive);
        if (!praying) return;
        const damage = randomInt(SCREECH_DAMAGE.min, SCREECH_DAMAGE.max);
        target.addProjectile(new Projectile(null, damage, king, target, "typeless", { setDelay: 0 }));
      });
    }
    this.throwCarrion();
    this.launchLarvae(player);
  }

  private endScreech() {
    const king = this.king!;
    king.clearSpotAnim("screech");
    king.currentStats.defence = KING_LEVELS.defence;
    this.attackSpeed = ATTACK_SPEED_AFTER_SCREECH;
    this.attacksLeft = randomInt(ATTACKS_BETWEEN_SCREECH.min, ATTACKS_BETWEEN_SCREECH.max);
    this.attackTimer = 2;
    // After each screech: ranged <-> magic for the next distance block, and (below 65%)
    // distance <-> melee blocks. Below 20% it stays at the wall.
    if (this.enraged) {
      this.mode = "melee";
    } else if (king.currentStats.hitpoint <= MELEE_THRESHOLD) {
      if (this.mode === "distance") {
        this.mode = "melee";
      } else {
        this.mode = "distance";
        this.style = this.style === "range" ? "magic" : "range";
      }
    } else {
      // Above 65% (including after larvae heal it back up) it only fights at range.
      this.mode = "distance";
      this.style = this.style === "range" ? "magic" : "range";
    }
    king.meleePhase = this.mode === "melee";
    FixedLayout.addChatMessage(
      this.mode === "melee" ? "The Maggot King lurches towards the bone wall!" : `The Maggot King readies its ${this.style === "range" ? "green" : "yellow"} spit.`,
      this.mode === "melee" ? "#ff4040" : this.style === "range" ? "#3fae1f" : "#d6b42a",
    );
  }

  private throwCarrion() {
    const piles: Tile[] = [];
    const count = randomInt(CARRION_PILES.min, CARRION_PILES.max);
    for (let attempt = 0; piles.length < count && attempt < 100; attempt++) {
      const tile = { x: randomInt(STRIP.minX, STRIP.maxX), y: randomInt(STRIP.minY, STRIP.maxY) };
      if (!piles.some((pile) => sameTile(pile, tile))) piles.push(tile);
    }
    const shadows = piles.map((tile) => new CarrionShadow(this, tile, false));
    shadows.forEach((shadow) => this.addEntity(shadow));
    piles.forEach((tile) => this.graphic(tile, SPOT.carrionProjectileBig.id));
    this.schedule(CARRION_FALL_TICKS, () => {
      shadows.forEach((shadow) => this.removeEntity(shadow));
      const player = this.players[0];
      const splatter: Tile[] = [];
      piles.forEach((tile) => {
        this.graphic(tile, SPOT.carrionGroundHit.id);
        this.entities.filter((entity) => (entity instanceof Bile || entity instanceof Carrion) && sameTile(entity.location, tile))
          .forEach((entity) => this.removeEntity(entity));
        const carrion = new Carrion(this, { ...tile });
        this.addEntity(carrion);
        this.schedule(CARRION_LIFETIME_TICKS, () => {
          if (!this.entities.includes(carrion)) return;
          this.removeEntity(carrion);
          this.graphic(carrion.location, SPOT.carrionGroundDespawn.id);
        });
        if (player && player.dying < 0 && sameTile(player.location, tile)) {
          player.addProjectile(new Projectile(null, randomInt(0, CARRION_MAX_HIT), player, player, "typeless", { setDelay: 0 }));
        }
        // Smaller bits hit tiles next to the pile.
        [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].forEach((d) => {
          const bit = { x: tile.x + d.x, y: tile.y + d.y };
          if (inStrip(bit) && Random.get() < 0.5 && !splatter.some((other) => sameTile(other, bit))) splatter.push(bit);
        });
      });
      const bits = splatter.map((tile) => new CarrionShadow(this, tile, true));
      bits.forEach((bit) => this.addEntity(bit));
      this.schedule(CARRION_SPLATTER_TICKS, () => {
        bits.forEach((bit) => this.removeEntity(bit));
        const victim = this.players[0];
        splatter.forEach((tile) => {
          this.graphic(tile, SPOT.carrionProjectileSmall.id);
          this.entities.filter((entity) => entity instanceof Bile && sameTile(entity.location, tile))
            .forEach((entity) => this.removeEntity(entity));
          if (victim && victim.dying < 0 && sameTile(victim.location, tile)) {
            victim.addProjectile(new Projectile(null, randomInt(0, CARRION_SPLATTER_MAX_HIT), victim, victim, "typeless", { setDelay: 0 }));
          }
        });
      });
    });
  }

  private launchLarvae(player: Player) {
    const hp = this.king!.currentStats.hitpoint;
    if (hp > LARVAE_THRESHOLD) return;
    const present = this.mobs.some((mob) => mob instanceof UrMaggotLarva && mob.dying < 0);
    const rows = [27, 28, 29, 30];
    if (hp <= MULTI_LARVAE_THRESHOLD) {
      if (present) return;
      rows.forEach(() => this.launchLarva(rows[Math.floor(Random.get() * rows.length)]));
      return;
    }
    this.launchLarva(rows[Math.floor(Random.get() * rows.length)]);
  }

  private launchLarva(row: number) {
    // First larva lands on the west side, then they alternate east / west.
    const west = this.larvaWest;
    this.larvaWest = !this.larvaWest;
    const larva = new UrMaggotLarva(this, { x: west ? STRIP.minX : STRIP.maxX, y: row });
    larva.setStats();
    larva.direction = west ? 1 : -1;
    this.addMob(larva);
    larva.playAnimation(2);
    this.schedule(LARVA_FLIGHT_TICKS, () => {
      if (larva.dying >= 0 || !this.mobs.includes(larva)) return;
      larva.flying = false;
      larva.playAnimation(0);
    });
  }

  private tickLarvae(player: Player) {
    const king = this.king!;
    this.mobs.filter((mob): mob is UrMaggotLarva => mob instanceof UrMaggotLarva && mob.dying < 0 && !mob.flying)
      .forEach((larva) => {
        // Standing under a larva: it stops and leeches 3, 4, 5... healing the king the same.
        // The tally resets when you step off.
        if (sameTile(player.location, larva.location)) {
          larva.chip = larva.chip > 0 ? larva.chip + 1 : LARVA_CHIP_START;
          player.addProjectile(new Projectile(null, larva.chip, larva, player, "typeless", { setDelay: 0 }));
          king.currentStats.hitpoint = Math.min(king.stats.hitpoint, king.currentStats.hitpoint + larva.chip);
          return;
        }
        larva.chip = 0;
        let next = larva.location.x + larva.direction;
        if (next < STRIP.minX || next > STRIP.maxX) {
          larva.direction = larva.direction === 1 ? -1 : 1;
          next = larva.location.x + larva.direction;
        }
        larva.glideTo({ x: next, y: larva.location.y });
        // Eats carrion: +1 HP to the king per pile.
        this.entities.filter((entity) => entity instanceof Carrion && sameTile(entity.location, larva.location))
          .forEach((entity) => {
            this.removeEntity(entity);
            king.currentStats.hitpoint = Math.min(king.stats.hitpoint, king.currentStats.hitpoint + 1);
          });
      });
  }

  // --- movement and slams ---------------------------------------------------------------------

  /** King x that centres it on the player's column. */
  private wallX(player: Player) {
    return Math.max(KING_MIN_X, Math.min(KING_MAX_X, player.location.x - 2));
  }

  private tickKingMovement(player: Player) {
    const king = this.king!;
    if (this.slam || this.screechTicks > 0) return;
    const target = this.mode === "melee"
      ? { x: this.wallX(player), y: KING_WALL_Y }
      : { x: king.location.x, y: KING_BACK_Y };
    if (sameTile(king.location, target)) return;
    // Forward/back first, then sideways.
    const step = king.location.y !== target.y
      ? { x: king.location.x, y: king.location.y + Math.sign(target.y - king.location.y) }
      : { x: king.location.x + Math.sign(target.x - king.location.x), y: king.location.y };
    const forward = step.y > king.location.y;
    const backward = step.y < king.location.y;
    king.glideTo(step);
    king.playAnimation(forward ? KingAnimations.WalkForwardMelee
      : backward ? KingAnimations.WalkBackward
        : step.x > king.location.x ? KingAnimations.WalkRight : KingAnimations.WalkLeft);
  }

  private startSlam(player: Player) {
    const king = this.king!;
    const centreX = king.location.x + 2;
    const markers: SlamMarker[] = [];
    for (let x = centreX - 1; x <= centreX + 1; x++) {
      for (let y = STRIP.minY; y <= STRIP.maxY; y++) {
        const marker = new SlamMarker(this, { x, y });
        markers.push(marker);
        this.addEntity(marker);
      }
    }
    this.slam = { at: this.fightTicks + SLAM_WINDUP_TICKS, centreX, markers };
    king.playAnimation(KingAnimations.Melee);
  }

  private tickSlam(player: Player) {
    const king = this.king!;
    if (!this.slam) {
      king.punishWindow = false;
      return;
    }
    // The punish window is the slam tick itself; player attacks resolve before this postTick.
    if (this.fightTicks === this.slam.at - 1) {
      king.punishWindow = true;
      return;
    }
    if (this.fightTicks < this.slam.at) return;
    const { centreX, markers } = this.slam;
    this.slam = null;
    markers.forEach((marker) => this.removeEntity(marker));
    const inArea = Math.abs(player.location.x - centreX) <= 1 && inStrip(player.location);
    if (inArea) {
      const protectedMelee = !!player.prayerController.findPrayerByName("Protect from Melee")?.isActive;
      const damage = randomInt(0, protectedMelee ? SLAM_PROTECTED_MAX_HIT : SLAM_MAX_HIT);
      player.addProjectile(new Projectile(null, damage, king, player, "typeless", { setDelay: 0 }));
    }
    // Three biles within two tiles in front.
    for (let index = 0; index < 3; index++) {
      const tile = { x: randomInt(centreX - 2, centreX + 2), y: randomInt(STRIP.minY, STRIP.minY + 1) };
      if (inStrip(tile)) this.placeBile(tile, Random.get() < 0.5 ? "poison" : "sticky");
    }
    this.resolvePunish(player);
    king.punishWindow = false;
  }

  /** Attacking on the slam tick: a free hit with 85% less crush defence and +50% damage. */
  private resolvePunish(player: Player) {
    const king = this.king!;
    const weapon = player.equipment.weapon;
    const adjacent = this.adjacentToKing(player.location);
    const meleeWeapon = weapon instanceof MeleeWeapon && weapon.attackRange <= 2;
    if (!(adjacent && meleeWeapon && player.aggro === king && player.dying < 0)) {
      if (king.currentStats.hitpoint <= MELEE_THRESHOLD) this.punishesMissed++;
      return;
    }
    this.punishes++;
    king.punishWindow = true;
    weapon.attack(player, king, {});
    const bonus = Math.floor(weapon.damage * (PUNISH_DAMAGE - 1));
    if (bonus > 0) king.addProjectile(new Projectile(weapon, bonus, player, king, "typeless", { setDelay: 1 }));
    FixedLayout.addChatMessage("Melee punish!", "#00ff00");
  }

  /** Melee reach: the strip row against the bone wall, under the king's front row. */
  private adjacentToKing(tile: Tile) {
    const king = this.king!;
    return tile.y === king.location.y + 1 && tile.x >= king.location.x && tile.x <= king.location.x + 4;
  }

  // --- floor hazards, poison and burns ----------------------------------------------------------

  private tickBile(player: Player) {
    const bile = this.entities.find((entity): entity is Bile => entity instanceof Bile && sameTile(entity.location, player.location));
    if (!bile) return;
    this.removeEntity(bile);
    if (bile.kind === "poison") {
      const damage = randomInt(POISON_BILE_DAMAGE.min, POISON_BILE_DAMAGE.max);
      player.addProjectile(new Projectile(null, damage, player, player, "typeless", { setDelay: 0 }));
      return;
    }
    // Sticky: 2-4, drains Attack/Strength/Defence by the same and delays your next attack.
    const damage = randomInt(STICKY_BILE_DAMAGE.min, STICKY_BILE_DAMAGE.max);
    player.addProjectile(new Projectile(null, damage, player, player, "typeless", { setDelay: 0 }));
    const stat = (["attack", "strength", "defence"] as const)[Math.floor(Random.get() * 3)];
    player.currentStats[stat] = Math.max(1, player.currentStats[stat] - damage);
    player.attackDelay += 1;
  }

  private tickPoison(player: Player) {
    if (this.poisonDamage <= 0) return;
    if (--this.poisonTimer > 0) return;
    this.poisonTimer = POISON_INTERVAL;
    player.addProjectile(new Projectile(null, this.poisonDamage, player, player, "poison", { setDelay: 0 }));
    if (++this.poisonHits % 5 === 0) this.poisonDamage--;
  }

  private tickBurns() {
    const king = this.king!;
    this.burnExpiries = this.burnExpiries.filter((expiry) => expiry > this.fightTicks);
    king.burnStacks = this.burnExpiries.length;
  }

  // --- hits -------------------------------------------------------------------------------------

  override onIncomingHit(unit: Unit, projectile: Projectile) {
    const player = this.players[0];
    const fromPlayer = projectile.from === player;
    const damage = Math.max(0, projectile.damage);

    if (unit instanceof UrMaggotLarva && fromPlayer && unit.flying) {
      // Standard ranged (bow and arrows) kills a larva before it lands; nothing else touches it.
      if (projectile.attackStyle === "range") {
        unit.currentStats.hitpoint = 0;
        FixedLayout.addChatMessage("You shoot down the larva.", "#00ff00");
      } else {
        unit.currentStats.hitpoint = Math.min(unit.stats.hitpoint, unit.currentStats.hitpoint + damage);
      }
      return;
    }

    if (unit === this.king && fromPlayer) {
      const king = this.king;
      const melee = ["stab", "slash", "crush"].includes(projectile.attackStyle);
      if (melee && king.currentStats.hitpoint + damage > MELEE_THRESHOLD) {
        // Out of melee reach until ~65%.
        king.currentStats.hitpoint = Math.min(king.stats.hitpoint, king.currentStats.hitpoint + damage);
        return;
      }
      if (isFireSpell(projectile.weapon) && damage > 0 && projectile.attackStyle === "magic") {
        if (this.burnExpiries.length < BURN_MAX_STACKS) {
          this.burnExpiries.push(this.fightTicks + BURN_STACK_TICKS);
          king.burnStacks = this.burnExpiries.length;
          this.schedule(2, () => {
            if (king.dying < 0) king.addProjectile(new Projectile(null, BURN_DAMAGE, player, king, "typeless", { setDelay: 0 }));
          });
        }
      }
    }
  }

  override onUnitDeath(unit: Unit) {
    const player = this.players[0];
    if (unit === player) {
      FixedLayout.addChatMessage("Oh dear, you are dead!", "#000000");
      this.replay.playerDied();
      return;
    }
    if (unit === this.king) {
      this.phase = "dead";
      this.scheduled = [];
      this.slam?.markers.forEach((marker) => this.removeEntity(marker));
      this.slam = null;
      this.entities.filter((entity) => entity instanceof CarrionShadow).forEach((entity) => this.removeEntity(entity));
      this.mobs.filter((mob) => mob instanceof UrMaggotLarva).forEach((mob) => this.removeMob(mob));
      this.graphic({ x: unit.location.x + 2, y: unit.location.y - 2 }, SPOT.deathVfx.id);
      FixedLayout.addChatMessage(`The Maggot King is dead! (${Math.floor(this.fightTicks * 0.6)}s)`, "#00aa00");
      this.notify();
    }
  }
}
