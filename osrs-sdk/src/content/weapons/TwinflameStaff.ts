import { AttackStyle, AttackStyleTypes } from "../../sdk/AttackStylesController";
import { AttackBonuses } from "../../sdk/gear/Weapon";
import { ItemName } from "../../sdk/ItemName";
import { Unit } from "../../sdk/Unit";
import { MagicWeapon } from "../../sdk/weapons/MagicWeapon";
import { MeleeWeapon } from "../../sdk/weapons/MeleeWeapon";
import { Projectile, ProjectileOptions } from "../../sdk/weapons/Projectile";
import { PlayerAnimationIndices } from "../../sdk/rendering/GLTFAnimationConstants";
import InventImage from "../../assets/images/weapons/Twinflame_staff.png";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { eliteVoidMageWorn } from "./void";

/** Fire Wave (standard spellbook): base max hit 20. */
export class FireWaveSpell extends MagicWeapon {
  /** Fire spells burn some bosses (e.g. the Maggot King); encounters check this marker. */
  readonly isFireSpell = true;
  /** Twinflame staff: +10% accuracy and damage, and a 40% echo hit one tick later. */
  twinflame = false;

  get itemName(): ItemName {
    return ItemName.FIRE_WAVE;
  }

  get attackRange() {
    return 10;
  }

  get attackSpeed() {
    return 5;
  }

  get attackAnimationId() {
    return PlayerAnimationIndices.CastSpell;
  }

  override _magicDamageBonusMultiplier(from: Unit, to: Unit, bonuses: AttackBonuses) {
    // Elite void mage adds 5% magic damage on top of the gear bonus.
    return super._magicDamageBonusMultiplier(from, to, bonuses) + (eliteVoidMageWorn(from) ? 0.05 : 0);
  }

  override _maxHit(from: Unit, to: Unit, bonuses: AttackBonuses) {
    const maxHit = super._maxHit(from, to, bonuses);
    return this.twinflame ? Math.floor(maxHit * 1.1) : maxHit;
  }

  cast(from: Unit, to: Unit) {
    const bonuses: AttackBonuses = {
      magicBaseSpellDamage: 20,
      attackStyle: "magic",
      gearMageMultiplier: this.twinflame ? 1.1 : 1,
      // Void mage: +45% magic accuracy (applied to the effective level).
      voidMultiplier: eliteVoidMageWorn(from) ? 1.45 : 1,
    };
    const options: ProjectileOptions = {
      visuals: { spotAnim: { id: CACHE_ASSETS.spotAnims.fireWaveTravel.id } },
    };
    if (!this.attack(from, to, bonuses, options)) return false;
    if (this.twinflame) {
      // The echo deals 40% of the first hit (rounded down), landing one tick after it.
      const echo = Math.floor(this.damage * 0.4);
      const firstDelay = Math.max(1, this.calculateHitDelay(Math.max(1, Math.round(Math.hypot(
        from.location.x - to.location.x, from.location.y - to.location.y)))));
      to.addProjectile(new Projectile(this, echo, from, to, "magic", { setDelay: firstDelay + 1, visuals: { hidden: true } }));
    }
    return true;
  }
}

/** Twinflame staff, autocasting Fire Wave. Casts take 6 ticks. */
export class TwinflameStaff extends MeleeWeapon {
  override get equipSoundId(): number {
    return CACHE_ASSETS.sounds.equipStaff.id;
  }

  get cacheItemId(): number {
    return CACHE_ASSETS.items.twinflameStaff.id;
  }

  autocastSpell = Object.assign(new FireWaveSpell(), { twinflame: true });

  constructor() {
    super();
    this.bonuses = {
      attack: { stab: 7, slash: -1, crush: 28, magic: 12, range: 0 },
      defence: { stab: 2, slash: 3, crush: 1, magic: 12, range: 0 },
      other: { meleeStrength: 22, rangedStrength: 0, magicDamage: 0, prayer: 0 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }

  attack(from: Unit, to: Unit, bonuses: AttackBonuses = {}): boolean {
    if (this.attackStyle() === AttackStyle.AUTOCAST && from.isPlayer) {
      return this.autocastSpell.cast(from, to) !== false;
    }
    return super.attack(from, to, bonuses);
  }

  attackStyles() {
    return [AttackStyle.ACCURATE, AttackStyle.AGGRESSIVECRUSH, AttackStyle.DEFENSIVE, AttackStyle.AUTOCAST];
  }

  attackStyleCategory(): AttackStyleTypes {
    return AttackStyleTypes.STAFF;
  }

  defaultStyle(): AttackStyle {
    return AttackStyle.AUTOCAST;
  }

  get itemName(): ItemName {
    return ItemName.TWINFLAME_STAFF;
  }

  get isTwoHander(): boolean {
    return false;
  }

  get attackRange() {
    return this.attackStyle() === AttackStyle.AUTOCAST ? 10 : 1;
  }

  get attackSpeed() {
    return this.attackStyle() === AttackStyle.AUTOCAST ? 6 : 4;
  }

  get attackAnimationId() {
    return this.attackStyle() === AttackStyle.AUTOCAST ? PlayerAnimationIndices.CastSpell : PlayerAnimationIndices.ZombieAxeCrush;
  }

  get weight(): number {
    return 2.267;
  }

  get inventoryImage() {
    return InventImage;
  }
}
