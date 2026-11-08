import {
  CardinalDirection,
  FixedLayout,
  GraphicsObject,
  ImageLoader,
  LineOfSight,
  MagicWeapon,
  MeleeWeapon,
  Mob,
  Pathing,
  Player,
  Projectile,
  Random,
  RangedWeapon,
  Region,
  ReplayLog,
  Viewport,
} from "osrs-sdk";
import type { Loadout, Location, Unit, Weapon } from "osrs-sdk";

import { ReplayController, type RunConfig } from "../colosseum/js/ReplayController";
import { DEFAULT_INVOCATIONS } from "../colosseum/js/Invocations";
import { DOOM_ASSETS } from "../../doomAssets";
import {
  CAR_SLAM_MAX_HIT,
  DELVES,
  DelveLevel,
  LARVA_EXPLOSION_MAX_HIT,
  LARVA_SPAWN_INTERVAL,
  ROCK_DEBRIS_MAX_HIT,
  ROCK_EXPLODE_TICKS,
  ROCK_FALL_TICKS,
  SHIELD_HITPOINTS,
  SHIELD_LARVA_INTERVAL,
  SHOCKWAVE_MAX,
  SHOCKWAVE_MIN,
  SHOCKWAVE_START_TICKS,
  TONGUE_MAX_HIT,
  VOLATILE_EARTH_TICKS,
} from "./DoomConfig";
import { AcidPool, ArenaBlocker, CarEye, DebrisShadow, DoomScene, EarthenShield, SolidRock } from "./DoomEntities";
import { BurrowedDoom, Doom, DoomAnimations, BurrowedDoomAnimations, Larva, LarvaKind, VolatileEarth } from "./DoomMobs";

type Tile = { x: number; y: number };
type Style = "magic" | "range" | "melee";
type Phase = "waiting" | "countdown" | "normal" | "volatile" | "shield" | "car" | "dead";

// Arena (trainer coordinates; cache tiles mirrored north-south: y = 63 - cacheY).
const ARENA = { minX: 19, maxX: 43, minY: 14, maxY: 38 };
const DOOM_SPAWN = { x: 29, y: 28 }; // 5x5 occupying x 29-33, y 24-28
const PLAYER_START = { x: 31, y: 33 };
const VOLATILE_EARTH_COUNT = 8;
const CAR_EYE_DELAY = 3; // assumed

const BLANK_MAP = (() => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 4;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#1a1410";
    context.fillRect(0, 0, 4, 4);
  }
  return canvas.toDataURL();
})();

const ORB_SPOTANIMS: Record<Style, number> = {
  magic: DOOM_ASSETS.spotAnims.projectileMagic.id,
  range: DOOM_ASSETS.spotAnims.projectileRange.id,
  melee: DOOM_ASSETS.spotAnims.projectileMelee.id,
};

const IMPACT_SPOTANIMS: Record<Style, number> = {
  magic: DOOM_ASSETS.spotAnims.impactMagic.id,
  range: DOOM_ASSETS.spotAnims.impactRange.id,
  melee: DOOM_ASSETS.spotAnims.impactMelee.id,
};

/** Orbs launched out of an exploding rock use the rock-launch graphics. */
const ROCK_ORB_SPOTANIMS: Record<Style, number> = {
  magic: DOOM_ASSETS.spotAnims.rockLaunchMagic.id,
  range: DOOM_ASSETS.spotAnims.rockLaunchRange.id,
  melee: DOOM_ASSETS.spotAnims.projectileMelee.id,
};

const SPOT = DOOM_ASSETS.spotAnims;
const BEAM_CHANNEL = "doom-beam";

const PRAYERS: Record<Style, string> = {
  magic: "Protect from Magic",
  range: "Protect from Range",
  melee: "Protect from Melee",
};

/** Weapons used only to carry the Doom's projectiles and decide which prayer blocks them. */
const STYLE_WEAPONS: Record<Style, Weapon> = {
  magic: new MagicWeapon(),
  range: new RangedWeapon(),
  melee: new MeleeWeapon(),
};

function inArena(tile: Tile) {
  return tile.x >= ARENA.minX && tile.x <= ARENA.maxX && tile.y >= ARENA.minY && tile.y <= ARENA.maxY;
}

function chebyshev(a: Tile, b: Tile) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function isDemonbane(weapon: unknown) {
  return !!(weapon as { isDemonbane?: boolean } | null)?.isDemonbane;
}

function styleOf(attackStyle: string): Style | "typeless" {
  if (attackStyle === "magic") return "magic";
  if (attackStyle === "range") return "range";
  if (["stab", "slash", "crush"].includes(attackStyle)) return "melee";
  return "typeless";
}

export type DoomSnapshot = {
  phase: Phase;
  delve: DelveLevel;
  shield: number;
  charge: number | null;
  chargeMax: number;
  demonicCharge: number;
  volatileTicks: number | null;
  meleeOnly: boolean;
  ticks: number;
  larvae: number;
  doomHp: number;
  doomMaxHp: number;
  /** Delve 6+ car phase: a slam is coming and you need rock cover. */
  slamIncoming: boolean;
};

/** Doom of Mokhaiotl, delves 5-8: arena, rotation and hazards. */
export class DoomRegion extends Region {
  readonly replay = new ReplayController(() => this.world);
  mapImage: HTMLImageElement = ImageLoader.createImage(BLANK_MAP);

  private selectedDelve: DelveLevel = 5;
  private runConfig: RunConfig;
  private doom: Doom | null = null;
  private burrowed: BurrowedDoom | null = null;
  private phase: Phase = "waiting";
  private startRequested = false;
  private countdown = 0;
  private fightTicks = 0;
  private attackTimer = 0;
  private attacksSinceRock = 0;
  private shockwaveDone = false;
  private attacksUntilShield = -1;
  private shieldHp = 0;
  private charge: number | null = null; // ticks until the beam fires
  private meleeChargeActive = false;
  private larvaTimer = LARVA_SPAWN_INTERVAL;
  private shieldDirection: Tile = { x: -1, y: 0 };
  private demonicCharge = 0;
  private volatileTicks: number | null = null;
  private volatileEarths: VolatileEarth[] = [];
  private brokenEarths: Tile[] = [];
  private shield: EarthenShield | null = null;
  private volatileAttacksLeft = 0;
  private rockQueued = false;
  private scheduled: { at: number; run: () => void }[] = [];
  private venomDamage = 0;
  private venomTimer = 0;
  private carZoomsLeft = 0;
  private carState: { eye: CarEye; delay: number; moving: boolean; attacksLeft: number; slamIn: number } | null = null;
  private listeners = new Set<() => void>();
  private snapshot: DoomSnapshot = this.makeSnapshot();

  constructor(loadouts: Loadout[] = []) {
    super(loadouts);
    ReplayLog.registerCustom("doomStart", () => {
      if (this.phase === "waiting") this.startRequested = true;
    });
  }

  get delveConfig() {
    return DELVES[this.selectedDelve];
  }

  getName() {
    return "Doom of Mokhaiotl";
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
    context.fillStyle = "#1a1410";
    context.fillRect(0, 0, 10000000, 10000000);
  }

  // --- UI state ---------------------------------------------------------------------------

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.snapshot;
  readonly getSelectedDelve = () => this.selectedDelve;

  private makeSnapshot(): DoomSnapshot {
    return Object.freeze({
      phase: this.phase,
      delve: this.selectedDelve,
      shield: this.shieldHp,
      charge: this.charge,
      chargeMax: DELVES[this.selectedDelve].beamChargeTicks,
      demonicCharge: this.demonicCharge,
      volatileTicks: this.volatileTicks,
      meleeOnly: this.meleeChargeActive,
      ticks: this.fightTicks,
      larvae: this.mobs.filter((mob) => mob instanceof Larva && mob.dying < 0).length,
      doomHp: this.doom?.currentStats.hitpoint ?? DELVES[this.selectedDelve].hitpoints,
      doomMaxHp: this.doom?.stats.hitpoint ?? DELVES[this.selectedDelve].hitpoints,
      slamIncoming: !!this.carState && !this.carState.moving && this.carState.slamIn > 0,
    });
  }

  private notify() {
    this.snapshot = this.makeSnapshot();
    this.listeners.forEach((listener) => listener());
  }

  setSelectedDelve(delve: DelveLevel) {
    if (this.phase !== "waiting") return;
    this.selectedDelve = delve;
    this.notify();
  }

  requestStart() {
    if (this.phase !== "waiting" || this.replay.isReplaying()) return;
    this.startRequested = true;
    ReplayLog.recordImmediate({ kind: "custom", name: "doomStart" });
  }

  // --- setup ------------------------------------------------------------------------------

  initialiseRegion() {
    const player = new Player(this, { ...PLAYER_START });
    this.addPlayer(player);

    // Invisible walls around the 25x25 arena.
    for (let x = ARENA.minX - 1; x <= ARENA.maxX + 1; x++) {
      this.addEntity(new ArenaBlocker(this, { x, y: ARENA.minY - 1 }));
      this.addEntity(new ArenaBlocker(this, { x, y: ARENA.maxY + 1 }));
    }
    for (let y = ARENA.minY; y <= ARENA.maxY; y++) {
      this.addEntity(new ArenaBlocker(this, { x: ARENA.minX - 1, y }));
      this.addEntity(new ArenaBlocker(this, { x: ARENA.maxX + 1, y }));
    }
    const regionId = this.selectedDelve >= 6 ? DOOM_ASSETS.regions.doomDeep.id : DOOM_ASSETS.regions.doomMid.id;
    this.addEntity(new DoomScene(this, regionId));
    return { player };
  }

  override reset(startWorld = true) {
    this.runConfig = this.replay.beginRun({
      wave: this.selectedDelve,
      forceDoubleSouth: false,
      npcsAggressive: true,
      invocations: DEFAULT_INVOCATIONS,
      autoPray: false,
      autoMove: false,
      autoFight: false,
    });
    this.selectedDelve = this.runConfig.wave as DelveLevel;
    this.doom = null;
    this.burrowed = null;
    this.phase = "waiting";
    this.startRequested = false;
    this.fightTicks = 0;
    this.attacksSinceRock = 0;
    this.shockwaveDone = false;
    this.attacksUntilShield = -1;
    this.shieldHp = 0;
    this.charge = null;
    this.meleeChargeActive = false;
    this.larvaTimer = LARVA_SPAWN_INTERVAL;
    this.demonicCharge = 0;
    this.volatileTicks = null;
    this.volatileEarths = [];
    this.brokenEarths = [];
    this.shield = null;
    this.scheduled = [];
    this.venomDamage = 0;
    this.carState = null;
    const reset = super.reset(false);
    this.world.getReadyTimer = 0;
    reset.player.frozen = 2;
    FixedLayout.chatMessages = [];
    FixedLayout.addChatMessage(`Delve level: ${this.selectedDelve}`, "#7f0000");
    Viewport.viewport.rotateNorth();
    this.notify();
    if (startWorld) this.world.startTicking();
    return reset;
  }

  /** Fetch every Doom model up front so spawns don't pop in. */
  override async preload() {
    const doom = new Doom(this, { ...DOOM_SPAWN });
    const preloads: Mob[] = [
      doom,
      new BurrowedDoom(this, { ...DOOM_SPAWN }, doom),
      ...(["neutral", "range", "magic", "melee", "giantRange", "giantMagic"] as LarvaKind[]).map((kind) => new Larva(this, { x: 0, y: 0 }, kind, doom)),
      new VolatileEarth(this, { x: 0, y: 0 }),
    ];
    await Promise.all([super.preload(), ...preloads.map((mob) => mob.preload())]);
  }

  private spawnDoom() {
    const config = this.delveConfig;
    const doom = new Doom(this, { ...DOOM_SPAWN }, { aggro: this.players[0] });
    doom.maxHitpoints = config.hitpoints;
    doom.delveCombatLevel = config.combatLevel;
    doom.setStats();
    this.addMob(doom);
    this.setBoss(doom);
    this.doom = doom;
    this.attackTimer = config.attackSpeed + 2;
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

  // --- main loop ----------------------------------------------------------------------------

  override postTick() {
    const player = this.players[0];
    if (this.phase === "waiting") {
      if (this.startRequested) {
        this.phase = "countdown";
        this.countdown = 2;
      } else if (player) {
        player.freeze(2);
      }
      this.notify();
      return;
    }
    if (this.phase === "countdown") {
      if (--this.countdown <= 0) {
        this.spawnDoom();
        this.phase = "normal";
        FixedLayout.addChatMessage("The Doom of Mokhaiotl emerges!", "#7f0000");
      }
      this.notify();
      return;
    }
    if (this.phase === "dead" || !player || player.dying >= 0 || !this.doom) {
      this.notify();
      return;
    }

    this.fightTicks++;
    this.runScheduled();
    this.tickVenom(player);
    this.tickShield();
    this.tickCharge(player);
    this.tickLarvae(player);

    switch (this.phase) {
      case "normal":
      case "volatile":
        this.tickAttacks(player);
        this.tickVolatile(player);
        break;
      case "shield":
        break;
      case "car":
        this.tickCar(player);
        break;
    }
    this.notify();
  }

  private tickAttacks(player: Player) {
    if (--this.attackTimer > 0) return;
    const config = this.delveConfig;
    this.attackTimer = config.attackSpeed;

    // Shield phase: at 75% HP after two attacks, or two attacks after a shockwave (delve 5+).
    const doom = this.doom!;
    if (this.phase === "normal") {
      if (this.attacksUntilShield > 0) this.attacksUntilShield--;
      const lowEnough = doom.currentStats.hitpoint <= doom.stats.hitpoint * 0.75;
      if ((this.attacksUntilShield === 0) || (this.attacksUntilShield < 0 && lowEnough && this.attacksSinceRock + 1 >= 2 && this.fightTicks > 10)) {
        this.startShield();
        return;
      }
      if (!this.shockwaveDone && this.fightTicks >= SHOCKWAVE_START_TICKS) {
        this.startVolatile(3);
      }
    }

    const mustRock = this.phase === "volatile" && this.rockQueued && this.volatileAttacksLeft <= 1;
    const wantsRock = this.attacksSinceRock >= 3 && Random.get() < 0.45;
    if (mustRock || wantsRock) {
      this.rockQueued = false;
      this.attacksSinceRock = 0;
      // A melee charge sometimes comes with a Rock Throw, never before shockwaves.
      const withCharge = this.phase === "normal" && Random.get() < 0.4;
      this.rockThrow(player, withCharge);
    } else {
      this.attacksSinceRock++;
      if (this.inMeleeRange(player)) this.tongue(player);
      else this.standardAttack(player);
    }
    if (this.phase === "volatile") this.volatileAttacksLeft--;
  }

  private inMeleeRange(player: Player) {
    const d = this.doom!;
    const { x, y } = player.location;
    return x >= d.location.x - 1 && x <= d.location.x + d.size && y <= d.location.y + 1 && y >= d.location.y - d.size;
  }

  // --- attacks ------------------------------------------------------------------------------

  /** Blue magic, green ranged or red melee orb; damage is decided on impact. */
  private standardAttack(player: Player, from: Unit = this.doom!) {
    const styles: Style[] = ["magic", "range", "melee"];
    const style = styles[Math.floor(Random.get() * styles.length)];
    this.doom?.playAnimation(DoomAnimations.StandardAttack);
    this.fireOrb(player, style, this.delveConfig.orbTravelTicks, from);
  }

  private fireOrb(player: Player, style: Style, travelTicks: number, from: Unit = this.doom!, fromRock = false) {
    const weapon = STYLE_WEAPONS[style];
    weapon.damage = Math.floor(Random.get() * (this.delveConfig.orbMaxHit + 1));
    const spotAnim = (fromRock ? ROCK_ORB_SPOTANIMS : ORB_SPOTANIMS)[style];
    weapon.registerProjectile(from, player, { attackStyle: style === "melee" ? "crush" : style }, {
      setDelay: travelTicks + 1,
      checkPrayerAtHit: true,
      visuals: { spotAnim: { id: spotAnim }, endCycleOffset: travelTicks * 30 },
    });
    this.schedule(travelTicks + 1, () => {
      const target = this.players[0];
      if (target && target.dying < 0) this.graphic(target.location, IMPACT_SPOTANIMS[style]);
    });
  }

  /** One-shot cache spot animation on a tile (visual only). */
  private graphic(tile: Tile, id: number, height = 0) {
    this.addEntity(new GraphicsObject(this, { x: tile.x, y: tile.y }, id, { height }));
  }

  /** Tongue lash if you stand next to it: up to 40, halved by Protect from Melee. */
  private tongue(player: Player) {
    this.doom?.playAnimation(DoomAnimations.Melee);
    let damage = Math.floor(Random.get() * (40 + 1));
    damage = Math.min(damage, TONGUE_MAX_HIT);
    if (player.prayerController.findPrayerByName(PRAYERS.melee)?.isActive) damage = Math.floor(damage / 2);
    player.addProjectile(new Projectile(null, damage, this.doom!, player, "typeless", { setDelay: 1 }));
  }

  private rockThrow(player: Player, withCharge: boolean) {
    const config = this.delveConfig;
    this.doom?.playAnimation(DoomAnimations.RockThrow);
    if (withCharge) this.startMeleeCharge();
    const throws = config.rockThrows;
    for (let index = 0; index < throws; index++) {
      // Delve 8 throws two identical rocks; the first's projectiles wait for the second to explode.
      const explodeAt = ROCK_EXPLODE_TICKS + index * 3;
      const projectileLanding = ROCK_EXPLODE_TICKS + (throws - 1) * 3 + ROCK_FALL_TICKS + config.rockProjectileDelay;
      this.schedule(explodeAt, () => this.rockExplode(projectileLanding - explodeAt));
    }
    this.attackTimer = Math.max(this.attackTimer, ROCK_EXPLODE_TICKS + 2);
  }

  /** Debris falls around where you stand now; your tile becomes a solid rock. */
  private rockExplode(projectileDelay: number) {
    const player = this.players[0];
    if (!player || player.dying >= 0) return;
    const centre = { ...player.location };
    const debris: Tile[] = [];
    for (let dx = -4; dx <= 4; dx++) {
      for (let dy = -4; dy <= 4; dy++) {
        const tile = { x: centre.x + dx, y: centre.y + dy };
        if (!inArena(tile) || (dx === 0 && dy === 0)) continue;
        if (Random.get() < 0.35) debris.push(tile);
      }
    }
    const shadows = [...debris, centre].map((tile) => new DebrisShadow(this, tile));
    shadows.forEach((shadow) => this.addEntity(shadow));
    [...debris, centre].forEach((tile) => this.graphic(tile, SPOT.rockDebris.id));
    this.schedule(ROCK_FALL_TICKS, () => {
      shadows.forEach((shadow) => this.removeEntity(shadow));
      const victim = this.players[0];
      if (!victim || victim.dying >= 0) return;
      const onDebris = debris.some((tile) => tile.x === victim.location.x && tile.y === victim.location.y);
      const onSolid = victim.location.x === centre.x && victim.location.y === centre.y;
      if (onDebris || onSolid) {
        const damage = Math.floor(Random.get() * (ROCK_DEBRIS_MAX_HIT + 1));
        victim.addProjectile(new Projectile(null, damage, victim, victim, "typeless", { setDelay: 0 }));
      }
      if (onSolid) this.shove(victim, centre);
      this.graphic(centre, SPOT.rockImpact.id);
      this.addEntity(new SolidRock(this, centre));
      // Overhead protection prayers are knocked off.
      Object.values(PRAYERS).forEach((name) => victim.prayerController.findPrayerByName(name)?.deactivate());
      FixedLayout.addChatMessage("The falling debris disrupts your prayers!", "#ff0000");
      // Then 1-3 ranged/magic projectiles, never the same style twice in a row.
      let style: Style = Random.get() < 0.5 ? "range" : "magic";
      for (let index = 0; index < this.delveConfig.rockProjectiles; index++) {
        const thisStyle = style;
        this.schedule(Math.max(0, projectileDelay - ROCK_FALL_TICKS - 1) + index, () => {
          const target = this.players[0];
          if (target && target.dying < 0) this.fireOrb(target, thisStyle, 1, this.doom!, true);
        });
        style = style === "range" ? "magic" : "range";
      }
    });
  }

  private shove(player: Player, from: Tile) {
    const options: Tile[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const tile = { x: from.x + dx, y: from.y + dy };
      if ((dx || dy) && inArena(tile) && Pathing.canTileBePathedTo(this, tile.x, tile.y, 1, true)) options.push(tile);
    }
    if (!options.length) return;
    const tile = options[Math.floor(Random.get() * options.length)];
    player.setLocation(tile);
    player.destinationLocation = { ...tile };
  }

  // --- beam charge / melee punish -----------------------------------------------------------

  private startMeleeCharge() {
    this.meleeChargeActive = true;
    this.doom!.meleeOnly = true;
    this.charge = this.delveConfig.beamChargeTicks;
    this.doom?.playAnimation(DoomAnimations.BeamCharge);
    this.doom?.addSpotAnim({ id: SPOT.beamChargeUp.id, channel: BEAM_CHANNEL });
    FixedLayout.addChatMessage("The Doom prays against range and magic and starts charging!", "#a53fff");
  }

  private tickCharge(player: Player) {
    if (this.charge === null) return;
    if (--this.charge > 0) return;
    this.fireBeam(player);
  }

  private fireBeam(player: Player) {
    const config = this.delveConfig;
    this.charge = null;
    this.doom?.playAnimation(DoomAnimations.BeamFire);
    this.doom?.clearSpotAnim(BEAM_CHANNEL);
    this.graphic(player.location, SPOT.beamImpact.id);
    player.addProjectile(new Projectile(null, config.beamDamage, this.doom!, player, "typeless", { setDelay: 1 }));
    FixedLayout.addChatMessage("The Doom unleashes its Special Beam Cannon!", "#ff0000");
    if (this.meleeChargeActive) {
      this.meleeChargeActive = false;
      this.doom!.meleeOnly = false;
    }
    if (this.phase === "shield") this.endShield();
  }

  // --- shield phase -------------------------------------------------------------------------

  private startShield() {
    this.phase = "shield";
    this.attacksUntilShield = -1;
    this.shieldHp = SHIELD_HITPOINTS;
    this.charge = this.delveConfig.beamChargeTicks;
    this.doom!.form = "shielded";
    this.doom?.playAnimation(DoomAnimations.BeamChargeLoop);
    this.doom?.addSpotAnim({ id: SPOT.beamChargeUp.id, channel: BEAM_CHANNEL });
    const directions = [{ x: -1, y: 0 }, { x: -1, y: -1 }, { x: -1, y: 1 }, { x: 0, y: -1 }];
    this.shieldDirection = directions[Math.floor(Random.get() * directions.length)];
    this.larvaTimer = 2;
    FixedLayout.addChatMessage("The Doom shields itself! Only demonbane can harm the shield.", "#a53fff");
  }

  private tickShield() {
    if (this.phase === "shield" && this.shieldHp <= 0) this.endShield();
  }

  private endShield() {
    this.charge = null;
    this.doom?.clearSpotAnim(BEAM_CHANNEL);
    this.shieldHp = 0;
    this.doom!.form = "normal";
    FixedLayout.addChatMessage("The demonic shield shatters!", "#a53fff");
    if (this.selectedDelve >= 5) this.startCar();
    else this.phase = "normal";
  }

  // --- larvae -------------------------------------------------------------------------------

  private tickLarvae(player: Player) {
    const doom = this.doom!;
    const config = this.delveConfig;
    for (const larva of this.mobs.filter((mob): mob is Larva => mob instanceof Larva && mob.dying < 0)) {
      if (!larva.reachedDoom()) continue;
      const multiplier = larva.giant ? 3 : 1;
      const heal = (10 + this.demonicCharge) * multiplier;
      const damage = (1 + this.demonicCharge) * multiplier;
      this.demonicCharge++;
      if (this.phase !== "shield") doom.currentStats.hitpoint = Math.min(doom.stats.hitpoint, doom.currentStats.hitpoint + heal);
      player.addProjectile(new Projectile(null, damage, larva, player, "typeless", { setDelay: 0 }));
      FixedLayout.addChatMessage(`A larva reached the Doom! (Demonic charge ${this.demonicCharge})`, "#ff0000");
      larva.dying = 0; // removed without exploding
      larva.currentStats.hitpoint = 0;
      (larva as unknown as { reachedAndConsumed: boolean }).reachedAndConsumed = true;
    }

    if (this.phase === "car") return;
    if (--this.larvaTimer > 0) return;
    if (this.phase === "shield") {
      this.larvaTimer = SHIELD_LARVA_INTERVAL;
      const kinds: LarvaKind[] = ["range", "magic", "melee"];
      this.spawnLarva(kinds[Math.floor(Random.get() * kinds.length)], this.shieldSpawnTile());
      return;
    }
    this.larvaTimer = LARVA_SPAWN_INTERVAL;
    if (config.giantLarvae) {
      this.spawnLarva(Random.get() < 0.5 ? "giantRange" : "giantMagic", this.nearPlayerTile(player));
    } else {
      for (let index = 0; index < config.larvaePerSpawn; index++) {
        this.spawnLarva(Random.get() < 0.5 ? "range" : "magic", this.nearPlayerTile(player));
      }
    }
  }

  private nearPlayerTile(player: Player): Tile {
    for (let attempt = 0; attempt < 20; attempt++) {
      const tile = { x: player.location.x + Math.floor(Random.get() * 5) - 2, y: player.location.y + Math.floor(Random.get() * 5) - 2 };
      if (inArena(tile) && Pathing.canTileBePathedTo(this, tile.x, tile.y, 1, true)) return tile;
    }
    return { ...player.location };
  }

  private shieldSpawnTile(): Tile {
    const centre = this.doomCentre();
    const base = { x: centre.x + this.shieldDirection.x * 10, y: centre.y + this.shieldDirection.y * 10 };
    const tile = {
      x: Math.min(ARENA.maxX, Math.max(ARENA.minX, base.x + Math.floor(Random.get() * 3) - 1)),
      y: Math.min(ARENA.maxY, Math.max(ARENA.minY, base.y + Math.floor(Random.get() * 3) - 1)),
    };
    return tile;
  }

  private spawnLarva(kind: LarvaKind, tile: Tile) {
    const larva = new Larva(this, tile, kind, this.doom!);
    larva.setStats();
    this.addMob(larva);
  }

  private doomCentre(): Tile {
    const d = this.burrowed ?? this.doom!;
    return { x: d.location.x + 2, y: d.location.y - 2 };
  }

  // --- volatile earth / shockwave -----------------------------------------------------------

  private startVolatile(attacksBefore: number) {
    this.shockwaveDone = true;
    this.phase = "volatile";
    this.volatileTicks = VOLATILE_EARTH_TICKS;
    this.volatileAttacksLeft = attacksBefore;
    this.rockQueued = true;
    this.brokenEarths = [];
    this.volatileEarths = [];
    for (let attempt = 0; this.volatileEarths.length < VOLATILE_EARTH_COUNT && attempt < 200; attempt++) {
      const tile = {
        x: ARENA.minX + 1 + Math.floor(Random.get() * (ARENA.maxX - ARENA.minX - 1)),
        y: ARENA.minY + 1 + Math.floor(Random.get() * (ARENA.maxY - ARENA.minY - 1)),
      };
      if (!Pathing.canTileBePathedTo(this, tile.x, tile.y, 1, true)) continue;
      if (this.volatileEarths.some((earth) => chebyshev(earth.location, tile) < 4)) continue;
      const earth = new VolatileEarth(this, tile);
      earth.setStats();
      this.addMob(earth);
      this.volatileEarths.push(earth);
    }
    this.doom?.playAnimation(DoomAnimations.AreaCharge);
    FixedLayout.addChatMessage("Volatile earth erupts! Break two to raise an earthen shield.", "#a53fff");
  }

  private tickVolatile(player: Player) {
    if (this.shield) {
      this.shield.tick();
      const centre = this.shield.centre;
      this.entities.filter((entity) => entity instanceof AcidPool && entity.location.x === centre.x && entity.location.y === centre.y)
        .forEach((entity) => this.removeEntity(entity));
    }
    if (this.volatileTicks === null) return;
    if (--this.volatileTicks > 0) return;
    this.volatileTicks = null;
    const config = this.delveConfig;
    this.doom?.playAnimation(DoomAnimations.AreaSlam);
    this.graphic(this.doomCentre(), SPOT.areaSlam.id);
    for (let index = 0; index < config.shockwaves; index++) {
      this.schedule(index * 2, () => {
        const target = this.players[0];
        if (!target || target.dying >= 0) return;
        const safe = this.shield?.covers(target.location) ?? false;
        if (safe) return;
        const damage = SHOCKWAVE_MIN + Math.floor(Random.get() * (SHOCKWAVE_MAX - SHOCKWAVE_MIN + 1));
        target.addProjectile(new Projectile(null, damage, this.doom!, target, "typeless", { setDelay: 0 }));
      });
    }
    this.schedule(config.shockwaves * 2, () => {
      this.volatileEarths.forEach((earth) => {
        if (earth.dying < 0) this.removeMob(earth);
      });
      this.volatileEarths = [];
      if (this.shield) this.removeEntity(this.shield);
      this.shield = null;
      this.phase = "normal";
      // Delve 5+: shield again after two more attacks (one of them a Rock Throw).
      this.attacksUntilShield = 2;
      this.attacksSinceRock = 3;
    });
  }

  private onVolatileEarthBroken(earth: VolatileEarth) {
    this.brokenEarths.push({ ...earth.location });
    if (this.brokenEarths.length === 2 && !this.shield) {
      const [destination, start] = this.brokenEarths;
      const anchor = (tile: Tile) => ({ x: tile.x - 1, y: tile.y + 1 });
      this.shield = new EarthenShield(this, anchor(start), anchor(destination), 1);
      this.addEntity(this.shield);
      FixedLayout.addChatMessage("An earthen shield forms!", "#c9a227");
    }
  }

  // --- car phase (delve 5+) -----------------------------------------------------------------

  private startCar() {
    const doom = this.doom!;
    const config = this.delveConfig;
    this.phase = "car";
    doom.playAnimation(DoomAnimations.Burrow);
    this.graphic(this.doomCentre(), SPOT.burrow.id);
    doom.form = "burrowed";
    const burrowed = new BurrowedDoom(this, { ...doom.location }, doom);
    burrowed.setStats();
    this.addMob(burrowed);
    this.burrowed = burrowed;
    this.setBoss(burrowed);
    this.carZoomsLeft = config.carZooms;
    this.charge = config.beamChargeTicks;
    // Falling rocks give cover from the slams (fewer at delve 8).
    const rocks = this.selectedDelve >= 8 ? 6 : 10;
    for (let index = 0, attempt = 0; index < rocks && attempt < 100; attempt++) {
      const tile = { x: ARENA.minX + Math.floor(Random.get() * 25), y: ARENA.minY + Math.floor(Random.get() * 25) };
      if (!Pathing.canTileBePathedTo(this, tile.x, tile.y, 1, true)) continue;
      if (chebyshev(tile, this.doomCentre()) < 4) continue;
      this.addEntity(new SolidRock(this, tile));
      index++;
    }
    this.carState = null;
    FixedLayout.addChatMessage("The Doom burrows!", "#a53fff");
  }

  private tickCar(player: Player) {
    const burrowed = this.burrowed!;
    const config = this.delveConfig;
    if (!this.carState) {
      if (this.carZoomsLeft <= 0) {
        this.endCar();
        return;
      }
      this.carZoomsLeft--;
      // Eye four tiles past the player, in the player's compass direction from the Doom's centre.
      const centre = this.doomCentre();
      const dx = Math.sign(player.location.x - centre.x);
      const dy = Math.sign(player.location.y - centre.y);
      const eyeTile = {
        x: Math.min(ARENA.maxX - 2, Math.max(ARENA.minX + 2, player.location.x + dx * 4)),
        y: Math.min(ARENA.maxY - 2, Math.max(ARENA.minY + 2, player.location.y + dy * 4)),
      };
      const eye = new CarEye(this, eyeTile);
      this.addEntity(eye);
      this.carState = { eye, delay: CAR_EYE_DELAY, moving: false, attacksLeft: 0, slamIn: -1 };
      return;
    }
    const state = this.carState;
    if (state.delay > 0) {
      state.delay--;
      if (state.delay === 0) {
        state.moving = true;
        burrowed.playAnimation(BurrowedDoomAnimations.Movement);
      }
      return;
    }
    if (state.moving) {
      // Zoom straight at the eye, trampling anything in the way.
      const target = { x: state.eye.location.x - 2, y: state.eye.location.y + 2 };
      for (let step = 0; step < config.carSpeed; step++) {
        if (burrowed.location.x === target.x && burrowed.location.y === target.y) break;
        burrowed.glideTo({
          x: burrowed.location.x + Math.sign(target.x - burrowed.location.x),
          y: burrowed.location.y + Math.sign(target.y - burrowed.location.y),
        });
        if (step % 2 === 0) this.graphic(this.doomCentre(), SPOT.burrowedMovement.id);
        this.trample(player);
      }
      if (burrowed.location.x === target.x && burrowed.location.y === target.y) {
        state.moving = false;
        this.removeEntity(state.eye);
        this.doom!.setLocation({ ...burrowed.location });
        if (config.carSlams) {
          const distance = chebyshev(this.doomCentre(), player.location);
          state.attacksLeft = distance < 5 ? 1 : distance < 9 ? 2 : 3;
          state.slamIn = state.attacksLeft * config.attackSpeed + 2;
        } else {
          this.carState = null;
        }
      }
      return;
    }
    // Delve 6+: a few standard attacks, then the Car Slam.
    if (state.attacksLeft > 0 && state.slamIn % config.attackSpeed === 2) {
      state.attacksLeft--;
      this.standardAttack(player, burrowed);
    }
    if (--state.slamIn <= 0) {
      this.carSlam(player);
      this.carState = null;
    }
  }

  private trample(player: Player) {
    const b = this.burrowed!;
    const { x, y } = player.location;
    const under = x >= b.location.x && x < b.location.x + 5 && y <= b.location.y && y > b.location.y - 5;
    // Rocks in the path are destroyed.
    this.entities.filter((entity) => entity instanceof SolidRock
      && entity.location.x >= b.location.x && entity.location.x < b.location.x + 5
      && entity.location.y <= b.location.y && entity.location.y > b.location.y - 5)
      .forEach((rock) => this.removeEntity(rock));
    if (!under) return;
    player.addProjectile(new Projectile(null, this.delveConfig.tramplesDamage, b, player, "typeless", { setDelay: 0 }));
    this.shove(player, player.location);
  }

  /** Hits you unless a rock is between you and the Doom; destroys every rock it can see. */
  private carSlam(player: Player) {
    const b = this.burrowed!;
    b.playAnimation(BurrowedDoomAnimations.Explosion);
    const centre = this.doomCentre();
    this.graphic(centre, SPOT.burrowedExplosion.id);
    this.graphic(centre, SPOT.burrowedExplosionAoe.id);
    const sees = (tile: Tile) => LineOfSight.hasLineOfSight(this, centre.x, centre.y, tile.x, tile.y, 1, 15, false);
    const rocks = this.entities.filter((entity) => entity instanceof SolidRock);
    // Check the player first, while the rocks still stand.
    const playerHidden = !sees(player.location);
    rocks.filter((rock) => chebyshev(rock.location, centre) <= 15 && this.rockExposed(rock.location, centre))
      .forEach((rock) => this.removeEntity(rock));
    if (playerHidden) {
      FixedLayout.addChatMessage("The rocks shield you from the slam.", "#c9a227");
      return;
    }
    const damage = Math.floor(Random.get() * (CAR_SLAM_MAX_HIT + 1));
    player.addProjectile(new Projectile(null, damage, b, player, "typeless", { setDelay: 0 }));
  }

  /** A rock survives a slam only if another rock stands between it and the Doom. */
  private rockExposed(tile: Tile, centre: Tile) {
    const steps = chebyshev(tile, centre);
    for (let step = 1; step < steps; step++) {
      const x = Math.round(centre.x + ((tile.x - centre.x) * step) / steps);
      const y = Math.round(centre.y + ((tile.y - centre.y) * step) / steps);
      if (this.entities.some((entity) => entity instanceof SolidRock && entity.location.x === x && entity.location.y === y)) return false;
    }
    return true;
  }

  private endCar() {
    const doom = this.doom!;
    if (this.burrowed) {
      doom.setLocation({ ...this.burrowed.location });
      this.removeMob(this.burrowed);
      this.burrowed = null;
    }
    doom.form = "normal";
    this.setBoss(doom);
    this.graphic(this.doomCentre(), SPOT.burrowedEmerge.id);
    doom.playAnimation(DoomAnimations.IdleAlt);
    this.charge = null;
    this.phase = "normal";
    // After the car phase: volatile earth, then 3 (delve 5) / 4 (delve 6+) attacks before the shockwave.
    this.startVolatile(this.selectedDelve >= 6 ? 4 : 3);
    this.attackTimer = 2;
  }

  // --- acid blood ---------------------------------------------------------------------------

  private sprayAcid() {
    if (this.selectedDelve < 3 || this.phase === "shield" || this.phase === "car") return;
    const config = this.delveConfig;
    const d = this.doom!;
    const directions = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    const dir = directions[Math.floor(Random.get() * directions.length)];
    const centre = this.doomCentre();
    for (let index = 0; index < config.acidTiles; index++) {
      const distance = 3 + Math.floor(Random.get() * config.acidRange);
      const lateral = Math.floor(Random.get() * 5) - 2;
      const tile = {
        x: centre.x + dir.x * distance + (dir.x === 0 ? lateral : 0),
        y: centre.y + dir.y * distance + (dir.y === 0 ? lateral : 0),
      };
      if (!inArena(tile)) continue;
      if (tile.x >= d.location.x && tile.x < d.location.x + 5 && tile.y <= d.location.y && tile.y > d.location.y - 5) continue;
      if (this.entities.some((entity) => entity instanceof AcidPool && entity.location.x === tile.x && entity.location.y === tile.y)) continue;
      const pool = new AcidPool(this, tile);
      pool.onVenom = () => this.envenom();
      this.addEntity(pool);
    }
  }

  private envenom() {
    if ((this.players[0]?.effects.antiVenom ?? 0) > 0) return;
    if (this.venomDamage === 0) {
      this.venomDamage = 6;
      this.venomTimer = 30;
      FixedLayout.addChatMessage("You have been envenomed!", "#007f00");
    }
  }

  private tickVenom(player: Player) {
    if (player.effects.antiVenom > 0) {
      player.effects.antiVenom--;
      this.venomDamage = 0;
      return;
    }
    if (this.venomDamage === 0 || --this.venomTimer > 0) return;
    player.addProjectile(new Projectile(null, this.venomDamage, player, player, "typeless", { setDelay: 0 }));
    this.venomDamage = Math.min(20, this.venomDamage + 2);
    this.venomTimer = 30;
  }

  // --- damage routing -----------------------------------------------------------------------

  override onIncomingHit(unit: Unit, projectile: Projectile) {
    const player = this.players[0];
    const fromPlayer = projectile.from === player;
    const damage = Math.max(0, projectile.damage);

    if (fromPlayer && (unit === this.doom || unit === this.burrowed)) {
      const style = styleOf(projectile.attackStyle);
      const undo = () => {
        unit.currentStats.hitpoint = Math.min(unit.stats.hitpoint, unit.currentStats.hitpoint + damage);
      };
      if (this.phase === "shield") {
        undo();
        if (isDemonbane(projectile.weapon)) {
          this.shieldHp -= Math.max(1, damage);
          this.charge = this.delveConfig.beamChargeTicks;
        } else {
          FixedLayout.addChatMessage("The demonic shield resists your attack!", "#a53fff");
        }
        return;
      }
      if (this.meleeChargeActive) {
        if (style !== "melee") {
          undo();
          return;
        }
        // Melee punish: interrupts the beam, adds floor(strength bonus / 5) and delays the next attack.
        this.meleeChargeActive = false;
        this.doom!.meleeOnly = false;
        this.charge = null;
        const bonus = Math.floor((player?.bonuses.other.meleeStrength ?? 0) / 5);
        if (bonus > 0) unit.addProjectile(new Projectile(null, bonus, player, unit, "typeless", { setDelay: 0 }));
        this.attackTimer += this.delveConfig.punishDelay;
        this.doom?.playAnimation(DoomAnimations.BeamCancel);
        this.doom?.clearSpotAnim(BEAM_CHANNEL);
        FixedLayout.addChatMessage(`Melee punish! +${bonus} damage.`, "#00ff00");
      }
      if (this.phase === "car") this.charge = this.delveConfig.beamChargeTicks;
      if (damage > 0) this.sprayAcid();
      return;
    }

    if (unit instanceof Larva && fromPlayer) {
      const style = styleOf(projectile.attackStyle);
      const before = unit.currentStats.hitpoint + damage;
      let dealt = 0;
      if (!unit.weakTo || unit.weakTo === style) dealt = isDemonbane(projectile.weapon) ? before : Math.min(1, before);
      unit.currentStats.hitpoint = Math.max(0, before - dealt);
      return;
    }

    if (unit instanceof VolatileEarth && fromPlayer) {
      unit.currentStats.hitpoint = 0;
    }
  }

  override onUnitDeath(unit: Unit) {
    const player = this.players[0];
    if (unit === player) {
      FixedLayout.addChatMessage("Oh dear, you are dead!", "#000000");
      this.replay.playerDied();
      return;
    }
    if (unit instanceof VolatileEarth) {
      this.onVolatileEarthBroken(unit);
      return;
    }
    if (unit instanceof Larva) {
      if ((unit as unknown as { reachedAndConsumed?: boolean }).reachedAndConsumed) return;
      this.larvaExplosion(unit);
      return;
    }
    if (unit === this.doom || unit === this.burrowed) {
      this.phase = "dead";
      this.charge = null;
      FixedLayout.addChatMessage(`Delve ${this.selectedDelve} complete! The Doom burrows deeper...`, "#00aa00");
      this.mobs.filter((mob) => mob instanceof Larva || mob instanceof VolatileEarth).forEach((mob) => this.removeMob(mob));
      // Pending hazards never resolve after the kill.
      this.scheduled = [];
      this.entities.filter((entity) => entity instanceof DebrisShadow || entity instanceof CarEye).forEach((entity) => this.removeEntity(entity));
      this.doom?.clearSpotAnim(BEAM_CHANNEL);
      this.notify();
    }
  }

  /** 3x3 (giant 4x4) explosion: hurts the Doom (or 100 shield) if it reaches it, otherwise you. */
  private larvaExplosion(larva: Larva) {
    const radius = larva.giant ? 2 : 1;
    const centre = larva.location;
    const doom = this.burrowed ?? this.doom;
    const covers = (x: number, y: number) => Math.abs(x - centre.x) <= radius && Math.abs(y - centre.y) <= radius;
    let hitsDoom = false;
    if (doom) {
      for (let dx = 0; dx < 5 && !hitsDoom; dx++) for (let dy = 0; dy < 5; dy++) {
        if (covers(doom.location.x + dx, doom.location.y - dy)) {
          hitsDoom = true;
          break;
        }
      }
    }
    if (hitsDoom && doom) {
      if (this.phase === "shield") {
        this.shieldHp -= 100;
      } else {
        const damage = 5 + Math.floor(Random.get() * 6);
        doom.addProjectile(new Projectile(null, damage, larva, doom, "typeless", { setDelay: 0 }));
      }
      return;
    }
    const player = this.players[0];
    if (player && player.dying < 0 && covers(player.location.x, player.location.y)) {
      const damage = Math.floor(Random.get() * (LARVA_EXPLOSION_MAX_HIT + 1));
      player.addProjectile(new Projectile(null, damage, larva, player, "typeless", { setDelay: 0 }));
    }
  }
}

