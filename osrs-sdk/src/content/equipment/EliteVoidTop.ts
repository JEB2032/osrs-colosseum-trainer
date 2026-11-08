import { ImageLoader } from "../../sdk/utils/ImageLoader";
import InventImage from "../../assets/images/equipment/Elite_void_top.png";
import { ItemName } from "../../sdk/ItemName";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { Chest } from "../../sdk/gear/Chest";

export class EliteVoidTop extends Chest {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.eliteVoidTop.id;
  }
  inventorySprite: HTMLImageElement = ImageLoader.createImage(this.inventoryImage);

  get itemName(): ItemName {
    return ItemName.ELITE_VOID_TOP;
  }
  get weight(): number {
    return 6.803;
  }
  get inventoryImage() {
    return InventImage;
  }

  constructor() {
    super();
    this.bonuses = {
      attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      defence: { stab: 45, slash: 45, crush: 45, magic: 45, range: 45 },
      other: { meleeStrength: 0, rangedStrength: 0, magicDamage: 0, prayer: 3 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }
}
