import { ImageLoader } from "../../sdk/utils/ImageLoader";
import InventImage from "../../assets/images/equipment/Blue_moon_tassets.png";
import { ItemName } from "../../sdk/ItemName";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { Legs } from "../../sdk/gear/Legs";

export class BlueMoonTassets extends Legs {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.blueMoonTassets.id;
  }
  inventorySprite: HTMLImageElement = ImageLoader.createImage(this.inventoryImage);

  get itemName(): ItemName {
    return ItemName.BLUE_MOON_TASSETS;
  }
  get weight(): number {
    return 1.36;
  }

  get inventoryImage() {
    return InventImage;
  }

  constructor() {
    super();
    this.bonuses = {
      attack: {
        stab: 0,
        slash: 0,
        crush: 0,
        magic: 22,
        range: 0,
      },
      defence: {
        stab: 0,
        slash: 0,
        crush: 23,
        magic: 32,
        range: 0,
      },
      other: {
        meleeStrength: 1,
        rangedStrength: 0,
        magicDamage: 0.01,
        prayer: 0,
      },
      targetSpecific: {
        undead: 0,
        slayer: 0,
      },
    };
  }
}
