import { ImageLoader } from "../../sdk/utils/ImageLoader";
import InventImage from "../../assets/images/equipment/Lightbearer.png";
import { ItemName } from "../../sdk/ItemName";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { Ring } from "../../sdk/gear/Ring";

export class Lightbearer extends Ring {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.lightbearer.id;
  }
  inventorySprite: HTMLImageElement = ImageLoader.createImage(this.inventoryImage);

  get itemName(): ItemName {
    return ItemName.LIGHTBEARER;
  }
  get weight(): number {
    return 0.05;
  }
  get inventoryImage() {
    return InventImage;
  }

  constructor() {
    super();
    this.bonuses = {
      attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      defence: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      other: { meleeStrength: 0, rangedStrength: 0, magicDamage: 0, prayer: 0 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }
}
