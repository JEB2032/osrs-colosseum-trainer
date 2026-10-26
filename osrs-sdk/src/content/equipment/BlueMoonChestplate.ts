import { ImageLoader } from "../../sdk/utils/ImageLoader";
import InventImage from "../../assets/images/equipment/Blue_moon_chestplate.png";
import { ItemName } from "../../sdk/ItemName";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { Chest } from "../../sdk/gear/Chest";

export class BlueMoonChestplate extends Chest {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.blueMoonChestplate.id;
  }
  inventorySprite: HTMLImageElement = ImageLoader.createImage(this.inventoryImage);

  get itemName(): ItemName {
    return ItemName.BLUE_MOON_CHESTPLATE;
  }
  get weight(): number {
    return 3.175;
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
        magic: 30,
        range: 0,
      },
      defence: {
        stab: 0,
        slash: 0,
        crush: 51,
        magic: 28,
        range: 0,
      },
      other: {
        meleeStrength: 2,
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
