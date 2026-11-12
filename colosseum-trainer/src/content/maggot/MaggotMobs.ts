import { CacheRenderModel, CacheRenderReferences, MagicWeapon, MeleeWeapon, Mob, RangedWeapon } from "osrs-sdk";
import type { Location, Region, UnitBonuses, UnitOptions } from "osrs-sdk";

import { MAGGOT_ASSETS } from "../../maggotAssets";
import {
  BURN_MAGIC_DEFENCE_DROP,
  KING_COMBAT_LEVEL,
  KING_HITPOINTS,
  KING_LEVELS,
  LARVA_HITPOINTS,
  MAGIC_DEFENCE_MELEE_PHASE,
  MAGIC_DEFENCE_NORMAL,
  PUNISH_DEFENCE_ROLL,
} from "./MaggotConfig";

/** Pose indices: the NPC definition's idle/walk, then MAGGOT_ASSETS.npcs.maggotKing.animations in order. */
export enum KingAnimations {
  Idle = 0,
  Walk = 1,
  Screech = 2,
  Melee = 3,
  WalkForwardMelee = 4,
  WalkBackward = 5,
  WalkBackwardMelee = 6,
  WalkRight = 7,
  WalkLeft = 8,
  Range = 9,
  Magic = 10,
  Death = 11,
}

export enum LarvaAnimations {
  Idle = 0,
  Walk = 1,
  Fly = 2,
}

const KING_PEN_HEIGHT = 1;

const KING_DEFENCE = { stab: 172, slash: 100, crush: 45, range: 158 };

/**
 * The Maggot King. It never paths or attacks on its own: MaggotRegion drives every attack and
 * step, so the mob provides stats (which change with burns, the slam phase and punishes), model,
 * animations and a clickable target.
 */
export class MaggotKing extends Mob {
  static readonly NPC_ID = MAGGOT_ASSETS.npcs.maggotKing.id;

  /** Fire spell burn stacks (each -20 magic defence). */
  burnStacks = 0;
  /** At the bone wall for slams: magic defence +400. */
  meleePhase = false;
  /** The slam tick: crush defence roll reduced by 85%. */
  punishWindow = false;

  constructor(region: Region, location: Location, options?: UnitOptions) {
    super(region, location, options);
  }

  override mobName() {
    return "Maggot King";
  }

  override get combatLevel() {
    return KING_COMBAT_LEVEL;
  }

  override setStats() {
    this.weapons = { crush: new MeleeWeapon(), range: new RangedWeapon(), magic: new MagicWeapon() };
    this.stats = { ...KING_LEVELS, hitpoint: KING_HITPOINTS };
    this.currentStats = JSON.parse(JSON.stringify(this.stats));
  }

  override get bonuses(): UnitBonuses {
    const magic = (this.meleePhase ? MAGIC_DEFENCE_MELEE_PHASE : MAGIC_DEFENCE_NORMAL) - this.burnStacks * BURN_MAGIC_DEFENCE_DROP;
    // An 85% smaller defence roll: (def + 9) * (bonus + 64) scaled by 0.15 through the bonus term.
    const crush = this.punishWindow
      ? Math.floor((KING_DEFENCE.crush + 64) * PUNISH_DEFENCE_ROLL) - 64
      : KING_DEFENCE.crush;
    return {
      attack: { stab: 400, slash: 400, crush: 400, magic: 200, range: 200 },
      defence: { stab: KING_DEFENCE.stab, slash: KING_DEFENCE.slash, crush, magic, range: KING_DEFENCE.range },
      other: { meleeStrength: 50, rangedStrength: 10, magicDamage: 1.57, prayer: 0 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }

  override get size() {
    return 5;
  }

  /** Its pen floor is a tile above the player's strip. */
  override getPerceivedLocation(tickPercent: number) {
    return { ...super.getPerceivedLocation(tickPercent), z: KING_PEN_HEIGHT };
  }

  override get attackRange() {
    return 40;
  }

  override get attackSpeed() {
    return 6;
  }

  override attackStyleForNewAttack() {
    return "range";
  }

  override attackStep() {
    // no autonomous attacks; the base step is also where death is detected
    this.detectDeath();
  }

  override movementStep() {
    // MaggotRegion moves it between the back of its pen and the bone wall
  }

  /** Move one tile and let the client interpolate it, instead of snapping like setLocation. */
  glideTo(to: Location) {
    if (this.consumesSpace) this.region.clearTileCollisionFlags(this.location.x, this.location.y, this.size);
    this.location = { ...to };
    if (this.consumesSpace) this.region.setTileCollisionFlags(to.x, to.y, this.size);
    this.visualPath.push({ ...to, run: false });
    this.visualMovementActive = true;
    this.region.refreshUnitChunk(this);
  }

  override get idlePoseId() {
    return KingAnimations.Idle;
  }

  override get walkingPoseId() {
    return KingAnimations.Walk;
  }

  override get attackAnimationId() {
    return KingAnimations.Range;
  }

  override get deathAnimationId() {
    return KingAnimations.Death;
  }

  override get deathAnimationLength() {
    return 5;
  }

  override create3dModel() {
    return CacheRenderModel.forRenderable(this, CacheRenderReferences.npc(MaggotKing.NPC_ID));
  }
}

/**
 * Ur-maggot larva. While flying it can only be shot down (standard ranged kills it outright);
 * once landed it crawls along its row, eating carrion and chipping at you.
 */
export class UrMaggotLarva extends Mob {
  static readonly NPC_ID = MAGGOT_ASSETS.npcs.urMaggotLarvae.id;

  flying = true;
  /** -1 west, +1 east. */
  direction: -1 | 1 = 1;
  /** Chip damage once latched on to the player (3, then +1 each tick). */
  chip = 0;

  constructor(region: Region, location: Location) {
    super(region, location, {});
  }

  override mobName() {
    return "Ur-maggot larvae";
  }

  override get combatLevel() {
    return 65;
  }

  override setStats() {
    this.weapons = { crush: new MeleeWeapon() };
    this.stats = { attack: 80, strength: 1, defence: 35, range: 1, magic: 1, hitpoint: LARVA_HITPOINTS };
    this.currentStats = JSON.parse(JSON.stringify(this.stats));
  }

  override get bonuses(): UnitBonuses {
    return {
      attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      defence: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      other: { meleeStrength: 0, rangedStrength: 0, magicDamage: 1, prayer: 0 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }

  override get size() {
    return 1;
  }

  override get attackRange() {
    return 1;
  }

  override attack() {
    // chip damage is applied by MaggotRegion
    return false;
  }

  override attackStep() {
    this.detectDeath();
  }

  override attackStyleForNewAttack() {
    return "crush";
  }

  override movementStep() {
    // MaggotRegion moves it along its row
  }

  glideTo(to: Location) {
    if (this.consumesSpace) this.region.clearTileCollisionFlags(this.location.x, this.location.y, this.size);
    this.location = { ...to };
    if (this.consumesSpace) this.region.setTileCollisionFlags(to.x, to.y, this.size);
    this.visualPath.push({ ...to, run: false });
    this.visualMovementActive = true;
    this.region.refreshUnitChunk(this);
  }

  override get idlePoseId() {
    return this.flying ? LarvaAnimations.Fly : LarvaAnimations.Idle;
  }

  override get walkingPoseId() {
    return LarvaAnimations.Walk;
  }

  override get consumesSpace() {
    return false;
  }

  override get deathAnimationLength() {
    return 1;
  }

  override create3dModel() {
    return CacheRenderModel.forRenderable(this, CacheRenderReferences.npc(UrMaggotLarva.NPC_ID));
  }
}
