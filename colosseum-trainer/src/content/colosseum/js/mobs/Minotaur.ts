import {
  CacheRenderModel,
  CacheRenderReferences,
  LineOfSight,
  MeleeWeapon,
  Mob,
  UnitBonuses,
} from "osrs-sdk";

import { COLOSSEUM_ASSETS } from "../../../../assets";

/** Semantic pose indices mapped to the cache sequences extracted for NPC 12812. */
export enum MinotaurAnimations {
  Idle = 0,
  Walk = 1,
  Defend = 2,
  Attack = 3,
  Heal = 4,
  Spawn = 5,
  Death = 6,
}

// Heal (OSRS Wiki): while the player is not in melee range (diagonals included), the minotaur heals
// monsters below 75% HP to full when their centre tile is within 7 tiles of, and in line of sight
// from, its own centre tile. The wiki gives no interval; it is assumed to run on its 5-tick attack timer.
const HEAL_RANGE = 7;
const HEAL_THRESHOLD = 0.75;
const HEAL_INTERVAL_TICKS = 5;

export class Minotaur extends Mob {
  static readonly NPC_ID = COLOSSEUM_ASSETS.npcs.minotaur.id;

  private healTimer = HEAL_INTERVAL_TICKS;

  override attackStep() {
    super.attackStep();
    if (this.dying >= 0 || !this.aggro || --this.healTimer > 0) return;
    this.healTimer = HEAL_INTERVAL_TICKS;
    if (this.targetInMeleeRange()) return;

    const centreX = this.location.x + 1;
    const centreY = this.location.y - 1;
    const healed = this.region.mobs.filter((mob) => {
      if (mob === this || !(mob instanceof Mob) || mob.dying >= 0 || mob.size % 2 === 0) return false;
      if (!mob.stats?.hitpoint || mob.currentStats.hitpoint >= mob.stats.hitpoint * HEAL_THRESHOLD) return false;
      const offset = (mob.size - 1) / 2;
      return LineOfSight.hasLineOfSight(
        this.region, centreX, centreY, mob.location.x + offset, mob.location.y - offset, 1, HEAL_RANGE, false,
      );
    });
    if (healed.length === 0) return;
    healed.forEach((mob) => (mob.currentStats.hitpoint = mob.stats.hitpoint));
    this.playAnimation(MinotaurAnimations.Heal);
  }

  /** Player within one tile of the minotaur's 3x3 footprint, including diagonals. */
  private targetInMeleeRange() {
    const { x, y } = this.aggro.location;
    const inX = x >= this.location.x - 1 && x <= this.location.x + this.size;
    const inY = y <= this.location.y + 1 && y >= this.location.y - this.size;
    return inX && inY;
  }

  override mobName() {
    return "Minotaur";
  }

  override get combatLevel() {
    return 318;
  }

  override setStats() {
    // Melee projectiles otherwise resolve on the firing tick. The Minotaur's
    // hitsplat is observed one tick after its attack.
    this.weapons = { crush: new MeleeWeapon({ setDelay: 2 }) };
    this.stats = {
      attack: 300,
      strength: 360,
      defence: 190,
      range: 120,
      magic: 250,
      hitpoint: 225,
    };
    this.currentStats = JSON.parse(JSON.stringify(this.stats));
  }

  override get bonuses(): UnitBonuses {
    return {
      attack: { stab: 0, slash: 0, crush: 15, magic: 0, range: 0 },
      defence: { stab: 0, slash: 0, crush: 0, magic: 0, range: 12 },
      other: { meleeStrength: 64, rangedStrength: 0, magicDamage: 1, prayer: 0 },
    };
  }

  override get attackSpeed() {
    return 5;
  }

  override get attackRange() {
    return 1;
  }

  override get size() {
    return 3;
  }

  override attackStyleForNewAttack() {
    return "crush";
  }

  override get idlePoseId() {
    return MinotaurAnimations.Idle;
  }

  override get walkingPoseId() {
    return MinotaurAnimations.Walk;
  }

  override get attackAnimationId() {
    return MinotaurAnimations.Attack;
  }

  override get deathAnimationId() {
    return MinotaurAnimations.Death;
  }

  override create3dModel() {
    return CacheRenderModel.forRenderable(this, CacheRenderReferences.npc(Minotaur.NPC_ID));
  }

  override get deathAnimationLength() {
    return 4;
  }
}
