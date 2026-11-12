import InventImage from "../../assets/images/weapons/Burning_claws.png";
import { AttackBonuses } from "../../sdk/gear/Weapon";
import { ItemName } from "../../sdk/ItemName";
import { Random } from "../../sdk/Random";
import { Unit } from "../../sdk/Unit";
import { ProjectileOptions } from "../../sdk/weapons/Projectile";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { DragonClaws } from "./DragonClaws";
import { voidMeleeWorn } from "./void";

/** Burning claws: 4-tick claws with the Burning barrage special (35%). Burns are not simulated. */
export class BurningClaws extends DragonClaws {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.burningClaws.id;
  }

  constructor() {
    super();
    this.bonuses = {
      attack: { stab: 43, slash: 54, crush: 0, magic: 0, range: 0 },
      defence: { stab: 3, slash: 6, crush: 1, magic: 0, range: 0 },
      other: { meleeStrength: 32, rangedStrength: 0, magicDamage: 0, prayer: 0 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }

  get itemName(): ItemName {
    return ItemName.BURNING_CLAWS;
  }

  get inventoryImage() {
    return InventImage;
  }

  specialAttackDrain(): number {
    return 35;
  }

  attack(from: Unit, to: Unit, bonuses: AttackBonuses = {}, options: ProjectileOptions = {}) {
    if (voidMeleeWorn(from)) bonuses.voidMultiplier = 1.1;
    return super.attack(from, to, bonuses, options);
  }

  /**
   * Burning barrage: up to three accuracy rolls; the first success rolls 75-175% of the max hit,
   * split 25% / 25% / 50% over three hitsplats.
   */
  specialAttack(from: Unit, to: Unit, bonuses: AttackBonuses = {}, options: ProjectileOptions = {}): boolean {
    bonuses.attackStyle = "slash";
    bonuses.styleBonus = bonuses.styleBonus || 0;
    bonuses.voidMultiplier = voidMeleeWorn(from) ? 1.1 : bonuses.voidMultiplier || 1;
    bonuses.gearMeleeMultiplier = bonuses.gearMeleeMultiplier || 1;
    bonuses.overallMultiplier = bonuses.overallMultiplier || 1;
    this._calculatePrayerEffects(from, to, bonuses);

    let total = 0;
    if (!this.isBlockable(from, to, bonuses)) {
      const hitChance = this._hitChance(from, to, bonuses);
      for (let roll = 0; roll < 3; roll++) {
        if (Random.get() <= hitChance) {
          const maxHit = this._maxHit(from, to, bonuses);
          const min = Math.floor(maxHit * 0.75);
          const max = Math.floor(maxHit * 1.75);
          total = min + Math.floor(Random.get() * (max - min + 1));
          break;
        }
      }
    }
    const first = Math.floor(total / 4);
    const hits = [first, first, total - 2 * first];
    hits.forEach((damage, hit) => {
      this.damageRoll = damage;
      this.damage = damage;
      this.grantXp(from, to);
      this.registerProjectile(from, to, bonuses, { ...options, sound: null, setDelay: hit < 2 ? 1 : 2 });
    });
    this.lastHitHit = total > 0;
    return true;
  }
}
