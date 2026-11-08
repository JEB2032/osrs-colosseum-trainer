import { AttackStyle, AttackStyleTypes } from "../../sdk/AttackStylesController";
import { ItemName } from "../../sdk/ItemName";
import { PlayerAnimationIndices } from "../../sdk/rendering/GLTFAnimationConstants";
import { MeleeWeapon } from "../../sdk/weapons/MeleeWeapon";
import InventImage from "../../assets/images/weapons/Crystal_halberd.png";
import { CACHE_ASSETS } from "../../assets/CacheAssets";

/** Crystal halberd: 7-tick, 2-tile reach. */
export class CrystalHalberd extends MeleeWeapon {
  override get equipSoundId(): number {
    return CACHE_ASSETS.sounds.equipSword.id;
  }

  get cacheItemId(): number {
    return CACHE_ASSETS.items.crystalHalberd.id;
  }

  constructor() {
    super();
    this.bonuses = {
      attack: { stab: 85, slash: 110, crush: 5, magic: -4, range: 0 },
      defence: { stab: -1, slash: 4, crush: 5, magic: 0, range: 0 },
      other: { meleeStrength: 118, rangedStrength: 0, magicDamage: 0, prayer: 0 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }

  attackStyles() {
    return [AttackStyle.CONTROLLED, AttackStyle.AGGRESSIVESLASH, AttackStyle.DEFENSIVE];
  }

  attackStyleCategory(): AttackStyleTypes {
    return AttackStyleTypes.SLASHSWORD;
  }

  defaultStyle(): AttackStyle {
    return AttackStyle.AGGRESSIVESLASH;
  }

  get itemName(): ItemName {
    return ItemName.CRYSTAL_HALBERD;
  }

  get isTwoHander(): boolean {
    return true;
  }

  get attackRange() {
    return 2;
  }

  get attackSpeed() {
    return 7;
  }

  get weight(): number {
    return 1.814;
  }

  get inventoryImage() {
    return InventImage;
  }

  override get attackAnimationId(): number {
    return PlayerAnimationIndices.ScytheSwing;
  }
}
