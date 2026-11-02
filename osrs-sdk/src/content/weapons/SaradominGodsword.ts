import InventoryImage from "../../assets/images/weapons/Saradomin_godsword.png";
import { AttackStyle, AttackStyleTypes } from "../../sdk/AttackStylesController";
import { AttackBonuses } from "../../sdk/gear/Weapon";
import { ItemName } from "../../sdk/ItemName";
import { Random } from "../../sdk/Random";
import { Unit } from "../../sdk/Unit";
import { MeleeWeapon } from "../../sdk/weapons/MeleeWeapon";
import { ProjectileOptions } from "../../sdk/weapons/Projectile";
import { CACHE_ASSETS } from "../../assets/CacheAssets";

/** Saradomin godsword: 6-tick two-handed slash weapon with the Healing Blade special. */
export class SaradominGodsword extends MeleeWeapon {
  override get equipSoundId(): number {
    return CACHE_ASSETS.sounds.equipSword.id;
  }

  get cacheItemId(): number {
    return CACHE_ASSETS.items.saradominGodsword.id;
  }

  constructor() {
    super();
    this.bonuses = {
      attack: { stab: 0, slash: 132, crush: 80, magic: 0, range: 0 },
      defence: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      other: { meleeStrength: 132, rangedStrength: 0, magicDamage: 0, prayer: 8 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }

  get weight(): number {
    return 10;
  }

  attackStyles() {
    return [AttackStyle.ACCURATE, AttackStyle.AGGRESSIVESLASH, AttackStyle.DEFENSIVE];
  }

  attackStyleCategory(): AttackStyleTypes {
    return AttackStyleTypes.SLASHSWORD;
  }

  defaultStyle(): AttackStyle {
    return AttackStyle.AGGRESSIVESLASH;
  }

  get itemName(): ItemName {
    return ItemName.SARADOMIN_GODSWORD;
  }

  get isTwoHander(): boolean {
    return true;
  }

  get attackRange(): number {
    return 1;
  }

  get attackSpeed(): number {
    return 6;
  }

  get inventoryImage() {
    return InventoryImage;
  }

  override get attackAnimationId(): number {
    return CACHE_ASSETS.playerAnimations.godswordSlash.id;
  }

  override get specialAttackAnimationId(): number {
    return CACHE_ASSETS.playerAnimations.saradominGodswordSpecial.id;
  }

  override get idleAnimationId(): number {
    return CACHE_ASSETS.playerAnimations.godswordIdle.id;
  }

  override get walkAnimationId(): number {
    return CACHE_ASSETS.playerAnimations.godswordWalk.id;
  }

  override get runAnimationId(): number {
    return CACHE_ASSETS.playerAnimations.godswordRun.id;
  }

  hasSpecialAttack(): boolean {
    return true;
  }

  /**
   * Healing Blade (50% energy): +10% max hit, doubled accuracy; on a successful hit heals 50% and
   * restores 25% Prayer of the damage dealt (rounded up, minimum 10 Hitpoints / 5 Prayer).
   */
  specialAttack(from: Unit, to: Unit, bonuses: AttackBonuses = {}, options: ProjectileOptions = {}): boolean {
    bonuses.attackStyle = "slash";
    bonuses.styleBonus = bonuses.styleBonus || 0;
    bonuses.voidMultiplier = bonuses.voidMultiplier || 1;
    bonuses.gearMeleeMultiplier = bonuses.gearMeleeMultiplier || 1;
    bonuses.overallMultiplier = bonuses.overallMultiplier || 1;
    this._calculatePrayerEffects(from, to, bonuses);

    const rollModifiers = to.incomingAttackRollModifiers({ attacker: from, weapon: this, bonuses });
    // Doubling the attack roll, expressed on the hit chance this engine exposes.
    const hitChance = Math.min(1, this._hitChance(from, to, bonuses) * 2);
    const hit = !this.isBlockable(from, to, bonuses) && (rollModifiers.guaranteedHit || Random.get() <= hitChance);
    const maxHit = Math.floor(this._maxHit(from, to, bonuses) * 1.1);
    const damage = hit ? (rollModifiers.maxDamage ? maxHit : Math.floor(Random.get() * (maxHit + 1))) : 0;

    this.damageRoll = damage;
    this.damage = damage;
    this.grantXp(from, to);
    this.registerProjectile(from, to, bonuses, {
      ...options,
      consumeTargetMaxDamageRoll: rollModifiers.maxDamage && rollModifiers.consumeAfterDamage,
      setDelay: 1,
    });

    if (hit) {
      const heal = Math.max(10, Math.ceil(damage / 2));
      const prayer = Math.max(5, Math.ceil(damage / 4));
      from.currentStats.hitpoint = Math.min(from.stats.hitpoint, from.currentStats.hitpoint + heal);
      from.currentStats.prayer = Math.min(from.stats.prayer, from.currentStats.prayer + prayer);
    }
    this.lastHitHit = hit;
    return true;
  }
}
