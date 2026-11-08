import { AttackStyle, AttackStyleTypes } from "../../sdk/AttackStylesController";
import { AttackBonuses } from "../../sdk/gear/Weapon";
import { ItemName } from "../../sdk/ItemName";
import { PlayerAnimationIndices } from "../../sdk/rendering/GLTFAnimationConstants";
import { Unit } from "../../sdk/Unit";
import { MeleeWeapon } from "../../sdk/weapons/MeleeWeapon";
import InventImage from "../../assets/images/weapons/Darklight.png";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { isDemonTarget } from "./demonbane";

/** Darklight: demonbane sword, +60% accuracy and damage against demons. */
export class Darklight extends MeleeWeapon {
  override get equipSoundId(): number {
    return CACHE_ASSETS.sounds.equipSword.id;
  }

  get cacheItemId(): number {
    return CACHE_ASSETS.items.darklight.id;
  }

  override get isDemonbane() {
    return true;
  }

  constructor() {
    super();
    this.bonuses = {
      attack: { stab: 10, slash: 16, crush: -2, magic: 0, range: 0 },
      defence: { stab: 0, slash: 3, crush: 2, magic: 2, range: 0 },
      other: { meleeStrength: 13, rangedStrength: 0, magicDamage: 0, prayer: 0 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }

  attack(from: Unit, to: Unit, bonuses: AttackBonuses = {}, options = {}) {
    if (isDemonTarget(to)) bonuses.gearMeleeMultiplier = (bonuses.gearMeleeMultiplier ?? 1) * 1.6;
    return super.attack(from, to, bonuses, options);
  }

  attackStyles() {
    return [AttackStyle.ACCURATE, AttackStyle.AGGRESSIVESLASH, AttackStyle.STAB, AttackStyle.DEFENSIVE];
  }

  attackStyleCategory(): AttackStyleTypes {
    return AttackStyleTypes.SLASHSWORD;
  }

  defaultStyle(): AttackStyle {
    return AttackStyle.AGGRESSIVESLASH;
  }

  get itemName(): ItemName {
    return ItemName.DARKLIGHT;
  }

  get isTwoHander(): boolean {
    return false;
  }

  get attackRange() {
    return 1;
  }

  get attackSpeed() {
    return 5;
  }

  get weight(): number {
    return 1.814;
  }

  get inventoryImage() {
    return InventImage;
  }

  override get attackAnimationId(): number {
    return PlayerAnimationIndices.SwordSlash;
  }
}
