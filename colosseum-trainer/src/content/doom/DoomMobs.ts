import {
  CacheRenderModel,
  CacheRenderReferences,
  MagicWeapon,
  MeleeWeapon,
  Mob,
  RangedWeapon,
} from "osrs-sdk";
import type { Location, Region, UnitBonuses, UnitOptions } from "osrs-sdk";

import { DOOM_ASSETS } from "../../doomAssets";

/** Pose indices: the NPC definition's idle/walk, then DOOM_ASSETS.npcs.doom.animations in order. */
export enum DoomAnimations {
  Idle = 0,
  Walk = 1,
  IdleAlt = 2,
  StandardAttack = 3,
  RockThrow = 4,
  BeamCharge = 5,
  BeamChargeLoop = 6,
  BeamCancel = 7,
  BeamFire = 8,
  AreaCharge = 9,
  AreaChargeLoop = 10,
  AreaSlam = 11,
  AreaSlamReturn = 12,
  Melee = 13,
  Burrow = 14,
  BurrowIdle = 15,
  Despawn = 16,
}

export enum BurrowedDoomAnimations {
  Idle = 0,
  Walk = 1,
  Movement = 2,
  Emerge = 3,
  Explosion = 4,
  BurrowIdle = 5,
}

/** Stats and bonuses are the same at every delve (wiki); only HP and max hits change. */
const DOOM_BONUSES: UnitBonuses = {
  attack: { stab: 210, slash: 210, crush: 210, magic: 125, range: 120 },
  defence: { stab: 300, slash: 300, crush: 60, magic: 160, range: 160 },
  other: { meleeStrength: 45, rangedStrength: 50, magicDamage: 1.3, prayer: 0 },
};

export type DoomForm = "normal" | "shielded" | "burrowed";

/**
 * The Doom of Mokhaiotl. It never paths or attacks on its own: DoomRegion drives every attack,
 * so the mob only provides stats, model, animations and a clickable target.
 */
export class Doom extends Mob {
  static readonly NPC_ID = DOOM_ASSETS.npcs.doom.id;

  /** Demon attribute: demonbane weapons get their bonus against it. */
  readonly isDemon = true;
  maxHitpoints = 625;
  delveCombatLevel = 758;
  form: DoomForm = "normal";
  /** Overhead protect from magic + missiles during a melee charge. */
  meleeOnly = false;

  constructor(region: Region, location: Location, options?: UnitOptions) {
    super(region, location, options);
  }

  override mobName() {
    return this.form === "shielded" ? "Doom of Mokhaiotl (Shielded)" : "Doom of Mokhaiotl";
  }

  override get combatLevel() {
    return this.delveCombatLevel;
  }

  override setStats() {
    this.weapons = {
      crush: new MeleeWeapon(),
      range: new RangedWeapon(),
      magic: new MagicWeapon(),
    };
    this.stats = { attack: 300, strength: 190, defence: 90, range: 110, magic: 275, hitpoint: this.maxHitpoints };
    this.currentStats = JSON.parse(JSON.stringify(this.stats));
  }

  override get bonuses(): UnitBonuses {
    return DOOM_BONUSES;
  }

  override get size() {
    return 5;
  }

  override get attackRange() {
    return 40;
  }

  override get attackSpeed() {
    return 5;
  }

  override attackStyleForNewAttack() {
    return "magic";
  }

  /** DoomRegion controls attacks and movement. */
  override attackStep() {
    // no autonomous attacks; the base step is also where death is detected
    this.detectDeath();
  }

  override movementStep() {
    // stationary outside the car phase (DoomRegion moves it directly)
  }

  override canBeAttacked() {
    return this.form !== "burrowed" && super.canBeAttacked();
  }

  override visible() {
    return this.form !== "burrowed" && super.visible();
  }

  override get idlePoseId() {
    return DoomAnimations.Idle;
  }

  override get walkingPoseId() {
    return DoomAnimations.Idle;
  }

  override get attackAnimationId() {
    return DoomAnimations.StandardAttack;
  }

  override get deathAnimationId() {
    return DoomAnimations.Despawn;
  }

  override get deathAnimationLength() {
    return 4;
  }

  override create3dModel() {
    return CacheRenderModel.forRenderable(this, CacheRenderReferences.npc(Doom.NPC_ID));
  }
}

/** The burrowed ("car") form. Shares the Doom's hitpoints, so damage here hurts the Doom. */
export class BurrowedDoom extends Mob {
  static readonly NPC_ID = DOOM_ASSETS.npcs.doomBurrowed.id;
  readonly isDemon = true;

  private readonly doom: Doom;

  constructor(region: Region, location: Location, doom: Doom) {
    super(region, location, {});
    this.doom = doom;
    this.setStats();
  }

  override mobName() {
    return "Doom of Mokhaiotl (Burrowed)";
  }

  override get combatLevel() {
    return this.doom.combatLevel;
  }

  override setStats() {
    this.weapons = { crush: new MeleeWeapon() };
    // Runs once from the base constructor before the Doom is known.
    if (!this.doom) {
      this.stats = { attack: 300, strength: 190, defence: 90, range: 110, magic: 275, hitpoint: 625 };
      this.currentStats = JSON.parse(JSON.stringify(this.stats));
      return;
    }
    // Shared objects: hits on the burrowed form come off the Doom's own health.
    this.stats = this.doom.stats;
    this.currentStats = this.doom.currentStats;
  }

  override get bonuses(): UnitBonuses {
    return DOOM_BONUSES;
  }

  override get size() {
    return 5;
  }

  override get attackRange() {
    return 40;
  }

  override attackStep() {
    // driven by DoomRegion
    this.detectDeath();
  }

  override movementStep() {
    // driven by DoomRegion
  }

  /** Move one tile and let the client interpolate it, instead of snapping like setLocation. */
  glideTo(to: Location) {
    if (this.consumesSpace) this.region.clearTileCollisionFlags(this.location.x, this.location.y, this.size);
    this.location = { ...to };
    if (this.consumesSpace) this.region.setTileCollisionFlags(to.x, to.y, this.size);
    this.visualPath.push({ ...to, run: true });
    this.visualMovementActive = true;
    this.region.refreshUnitChunk(this);
  }

  override get idlePoseId() {
    return BurrowedDoomAnimations.BurrowIdle;
  }

  override get walkingPoseId() {
    return BurrowedDoomAnimations.Movement;
  }

  override get deathAnimationLength() {
    return 1;
  }

  override create3dModel() {
    return CacheRenderModel.forRenderable(this, CacheRenderReferences.npc(BurrowedDoom.NPC_ID));
  }
}

export type LarvaKind = "neutral" | "range" | "magic" | "melee" | "giantRange" | "giantMagic";

const LARVA_NPCS: Record<LarvaKind, number> = {
  neutral: DOOM_ASSETS.npcs.larva.id,
  range: DOOM_ASSETS.npcs.larvaRange.id,
  magic: DOOM_ASSETS.npcs.larvaMagic.id,
  melee: DOOM_ASSETS.npcs.larvaMelee.id,
  giantRange: DOOM_ASSETS.npcs.giantLarvaRange.id,
  giantMagic: DOOM_ASSETS.npcs.giantLarvaMagic.id,
};

/** Demonic larva: crawls to the Doom; only its colour's style hurts it (2 HP, giants 4). */
export class Larva extends Mob {
  readonly isDemon = true;

  constructor(region: Region, location: Location, readonly kind: LarvaKind, private readonly doom: Mob) {
    super(region, location, { aggro: doom });
  }

  get giant() {
    return this.kind === "giantRange" || this.kind === "giantMagic";
  }

  /** The combat style that can damage it (null: any). */
  get weakTo(): "range" | "magic" | "melee" | null {
    if (this.kind === "range" || this.kind === "giantRange") return "range";
    if (this.kind === "magic" || this.kind === "giantMagic") return "magic";
    if (this.kind === "melee") return "melee";
    return null;
  }

  override mobName() {
    const style = this.weakTo ? `${this.weakTo === "range" ? "range" : this.weakTo} ` : "";
    return `${this.giant ? "Giant demonic" : "Demonic"} ${style}larva`;
  }

  override get combatLevel() {
    return 1;
  }

  override setStats() {
    this.weapons = { crush: new MeleeWeapon() };
    const hitpoint = this.giant ? 4 : 2;
    this.stats = { attack: 1, strength: 1, defence: 1, range: 1, magic: 1, hitpoint };
    this.currentStats = JSON.parse(JSON.stringify(this.stats));
  }

  override get bonuses(): UnitBonuses {
    return {
      attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      defence: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      other: { meleeStrength: 0, rangedStrength: 0, magicDamage: 1, prayer: 0 },
    };
  }

  override get size() {
    return this.giant ? 2 : 1;
  }

  override get attackRange() {
    return 1;
  }

  override attack() {
    // Larvae never attack; reaching the Doom is handled by DoomRegion.
    return false;
  }

  override attackStep() {
    // crawl only (movement is handled by the base pathing towards the Doom)
    this.detectDeath();
  }

  override attackStyleForNewAttack() {
    return "crush";
  }

  /** Touching the Doom's footprint (it crawls to its centre in game). */
  reachedDoom() {
    const d = this.doom;
    const lx = this.location.x, ly = this.location.y, s = this.size;
    return lx + s >= d.location.x && lx <= d.location.x + d.size
      && ly >= d.location.y - d.size && ly - s <= d.location.y;
  }

  override get deathAnimationLength() {
    return 1;
  }

  override create3dModel() {
    return CacheRenderModel.forRenderable(this, CacheRenderReferences.npc(LARVA_NPCS[this.kind]));
  }
}

/** Volatile earth: 1 HP, attack two of them to raise an earthen shield before the shockwave. */
export class VolatileEarth extends Mob {
  static readonly NPC_ID = DOOM_ASSETS.npcs.volatileEarth.id;

  constructor(region: Region, location: Location) {
    super(region, location, {});
  }

  override mobName() {
    return "Volatile earth";
  }

  override get combatLevel() {
    return 0;
  }

  override setStats() {
    this.weapons = { crush: new MeleeWeapon() };
    this.stats = { attack: 1, strength: 1, defence: 1, range: 1, magic: 1, hitpoint: 1 };
    this.currentStats = JSON.parse(JSON.stringify(this.stats));
  }

  override get bonuses(): UnitBonuses {
    return {
      attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      defence: { stab: -100, slash: -100, crush: -100, magic: -100, range: -100 },
      other: { meleeStrength: 0, rangedStrength: 0, magicDamage: 1, prayer: 0 },
    };
  }

  override get size() {
    return 1;
  }

  override attack() {
    return false;
  }

  override attackStep() {
    // inert
    this.detectDeath();
  }

  override movementStep() {
    // inert
  }

  override get deathAnimationLength() {
    return 1;
  }

  override create3dModel() {
    return CacheRenderModel.forRenderable(this, CacheRenderReferences.npc(VolatileEarth.NPC_ID));
  }
}
