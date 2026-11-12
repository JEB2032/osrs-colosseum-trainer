import { AttackStyle, AttackStyleTypes } from "../../sdk/AttackStylesController";
import { AttackBonuses } from "../../sdk/gear/Weapon";
import { ItemName } from "../../sdk/ItemName";
import { Unit } from "../../sdk/Unit";
import { MeleeWeapon } from "../../sdk/weapons/MeleeWeapon";
import { PlayerAnimationIndices } from "../../sdk/rendering/GLTFAnimationConstants";
import InventImage from "../../assets/images/weapons/Abyssal_bludgeon.png";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { voidMeleeWorn } from "./void";

/** Abyssal bludgeon: 4-tick crush. (Penance special attack not simulated.) */
export class AbyssalBludgeon extends MeleeWeapon {
  override get equipSoundId(): number {
    return CACHE_ASSETS.sounds.equipFun.id;
  }

  get cacheItemId(): number {
    return CACHE_ASSETS.items.abyssalBludgeon.id;
  }

  constructor() {
    super();
    this.bonuses = {
      attack: { stab: 0, slash: 0, crush: 102, magic: 0, range: 0 },
      defence: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      other: { meleeStrength: 85, rangedStrength: 0, magicDamage: 0, prayer: 0 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }

  attack(from: Unit, to: Unit, bonuses: AttackBonuses = {}, options = {}) {
    if (voidMeleeWorn(from)) bonuses.voidMultiplier = 1.1;
    return super.attack(from, to, bonuses, options);
  }

  attackStyles() {
    return [AttackStyle.AGGRESSIVECRUSH];
  }

  attackStyleCategory(): AttackStyleTypes {
    return AttackStyleTypes.BLUDGEON;
  }

  defaultStyle(): AttackStyle {
    return AttackStyle.AGGRESSIVECRUSH;
  }

  get itemName(): ItemName {
    return ItemName.ABYSSAL_BLUDGEON;
  }

  get isTwoHander(): boolean {
    return true;
  }

  get attackRange() {
    return 1;
  }

  get attackSpeed() {
    return 4;
  }

  get weight(): number {
    return 0.453;
  }

  get inventoryImage() {
    return InventImage;
  }

  override get attackAnimationId(): number {
    return PlayerAnimationIndices.ZombieAxeCrush;
  }
}
