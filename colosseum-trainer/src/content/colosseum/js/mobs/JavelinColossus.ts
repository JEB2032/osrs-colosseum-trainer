import {
  CacheRenderModel,
  CacheRenderReferences,
  cacheSound,
  DelayedAction,
  Mob,
  Projectile,
  Random,
  RangedWeapon,
  Sound,
  TileMarker,
  UnitBonuses,
} from "osrs-sdk";
import type { Model } from "osrs-sdk";

import { COLOSSEUM_ASSETS } from "../../../../assets";

/** Semantic pose indices mapped to the cache sequences extracted for NPC 12817. */
export enum JavelinColossusAnimations {
  Idle = 0,
  Walk = 1,
  RangeAttack = 2,
  ArtilleryAttack = 3,
  Death = 4,
}

class JavelinWeapon extends RangedWeapon {
  override calculateHitDelay(distance: number) {
    // observed this always takes 3 ticks to land. add one because it gets decremented immediately
    return 3 + 1;
  }
}

// Javelin toss (OSRS Wiki strategy guide): every fifth attack is replaced by a javelin thrown high
// into the air at the player's tile. It lands 6 ticks later for up to 40 typeless damage, which
// Protect from Missiles does not block.
const TOSS_EVERY_N_ATTACKS = 5;
const TOSS_LANDING_TICKS = 6;
const TOSS_MAX_HIT = 40;

/** The Fortis Colosseum's Javelin Colossus (NPC definition 12817). */
export class JavelinColossus extends Mob {
  static readonly NPC_ID = COLOSSEUM_ASSETS.npcs.javelinColossus.id;

  private attacksMade = 0;
  private tossing = false;

  override attack() {
    const target = this.aggro;
    if (!target || target.dying >= 0) return false;
    this.attacksMade++;
    this.tossing = this.attacksMade % TOSS_EVERY_N_ATTACKS === 0;
    if (!this.tossing) return super.attack();

    const tile = { x: target.location.x, y: target.location.y };
    const marker = new TileMarker(this.region, { ...tile }, "#FF3000", 1, false);
    this.region.addEntity(marker);
    DelayedAction.registerDelayedNpcAction(new DelayedAction(() => {
      this.region.removeEntity(marker);
      if (target.dying >= 0) return;
      if (target.location.x === tile.x && target.location.y === tile.y) {
        const damage = Math.floor(Random.get() * (TOSS_MAX_HIT + 1));
        target.addProjectile(new Projectile(null, damage, target, target, "typeless", { setDelay: 0 }));
      }
    }, TOSS_LANDING_TICKS));
    return true;
  }

  override get attackAnimationId() {
    return this.tossing ? JavelinColossusAnimations.ArtilleryAttack : JavelinColossusAnimations.RangeAttack;
  }

  override mobName() {
    return "Javelin Colossus";
  }

  override get combatLevel() {
    return 278;
  }

  override setStats() {
    this.weapons = {
      range: new JavelinWeapon({
        visuals: {
          spotAnim: {
            id: COLOSSEUM_ASSETS.spotAnims.javelinColossusProjectile.id
          },
          startCycleOffset: 60,
          endCycleOffset: 90,
        }
      }),
    };
    this.stats = {
      attack: 200,
      strength: 300,
      defence: 190,
      range: 360,
      magic: 225,
      hitpoint: 220,
    };
    this.currentStats = JSON.parse(JSON.stringify(this.stats));
  }

  override get bonuses(): UnitBonuses {
    return {
      attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 25 },
      defence: { stab: 15, slash: 15, crush: 15, magic: 20, range: 30 },
      other: { meleeStrength: 0, rangedStrength: 20, magicDamage: 1, prayer: 0 },
    };
  }

  override get attackSpeed() {
    return 5;
  }

  override get attackRange() {
    return 15;
  }

  override get maxHit() {
    return 48;
  }

  override get size() {
    return 3;
  }

  override attackStyleForNewAttack() {
    return "range";
  }

  override get idlePoseId() {
    return JavelinColossusAnimations.Idle;
  }

  override get walkingPoseId() {
    return JavelinColossusAnimations.Walk;
  }

  override get deathAnimationId() {
    return JavelinColossusAnimations.Death;
  }

  override create3dModel(): Model {
    return CacheRenderModel.forRenderable(this, CacheRenderReferences.npc(JavelinColossus.NPC_ID));
  }

  override get deathAnimationLength() {
    return 3;
  }
}
