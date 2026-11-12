import InventImage from "../../assets/images/weapons/Crystal_bow.png";
import { ItemName } from "../../sdk/ItemName";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { BowOfFaerdhinen } from "./BowOfFaerdhinen";

/** Crystal bow: ammo-free standard ranged (kills ur-maggot larvae in flight). */
export class CrystalBow extends BowOfFaerdhinen {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.crystalBow.id;
  }

  constructor() {
    super();
    this.bonuses = {
      attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 100 },
      defence: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      other: { meleeStrength: 0, rangedStrength: 78, magicDamage: 0, prayer: 0 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }

  get itemName(): ItemName {
    return ItemName.CRYSTAL_BOW;
  }

  get weight(): number {
    return 1.5;
  }

  get inventoryImage() {
    return InventImage;
  }
}
