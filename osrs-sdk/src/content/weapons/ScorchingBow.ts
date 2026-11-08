import { AttackStyle, AttackStyleTypes } from "../../sdk/AttackStylesController";
import { AttackBonuses } from "../../sdk/gear/Weapon";
import { ItemName } from "../../sdk/ItemName";
import { PlayerAnimationIndices } from "../../sdk/rendering/GLTFAnimationConstants";
import { Unit } from "../../sdk/Unit";
import { RangedWeapon } from "../../sdk/weapons/RangedWeapon";
import InventImage from "../../assets/images/weapons/Scorching_bow.png";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { isDemonTarget, eliteVoidRangedMultipliers } from "./demonbane";

/** Scorching bow: demonbane, +30% accuracy and damage against demons. */
export class ScorchingBow extends RangedWeapon {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.scorchingBow.id;
  }

  override get isDemonbane() {
    return true;
  }

  constructor() {
    super();
    this.bonuses = {
      attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 124 },
      defence: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      other: { meleeStrength: 0, rangedStrength: 40, magicDamage: 0, prayer: 0 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }

  compatibleAmmo(): ItemName[] {
    return [ItemName.AMETHYST_ARROWS, ItemName.DRAGON_ARROWS];
  }

  attackStyles() {
    return [AttackStyle.ACCURATE, AttackStyle.RAPID, AttackStyle.LONGRANGE];
  }

  attackStyleCategory(): AttackStyleTypes {
    return AttackStyleTypes.BOW;
  }

  defaultStyle(): AttackStyle {
    return AttackStyle.RAPID;
  }

  get attackSpeed() {
    return this.attackStyle() === AttackStyle.LONGRANGE ? 6 : 5;
  }

  get weight(): number {
    return 1.814;
  }

  get itemName(): ItemName {
    return ItemName.SCORCHING_BOW;
  }

  get isTwoHander(): boolean {
    return true;
  }

  get attackRange() {
    return 10;
  }

  get inventoryImage() {
    return InventImage;
  }

  attack(from: Unit, to: Unit, bonuses: AttackBonuses = {}, options = {}) {
    const voidBonus = eliteVoidRangedMultipliers(from);
    bonuses.voidMultiplier = voidBonus.accuracy;
    bonuses.overallMultiplier = (bonuses.overallMultiplier ?? 1) * voidBonus.damageAfterAccuracy;
    return super.attack(from, to, bonuses, options);
  }

  _accuracyMultiplier(from: Unit, to: Unit) {
    return isDemonTarget(to) ? 1.3 : 1;
  }

  _damageMultiplier(from: Unit, to: Unit) {
    return isDemonTarget(to) ? 1.3 : 1;
  }

  get attackAnimationId() {
    return PlayerAnimationIndices.FireBow;
  }
}
