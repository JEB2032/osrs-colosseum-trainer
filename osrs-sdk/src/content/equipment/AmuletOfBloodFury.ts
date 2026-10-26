import { ImageLoader } from "../../sdk/utils/ImageLoader";
import InventImage from "../../assets/images/equipment/Amulet_of_blood_fury.png";
import { ItemName } from "../../sdk/ItemName";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { Necklace } from "../../sdk/gear/Necklace";

export class AmuletOfBloodFury extends Necklace {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.amuletOfBloodFury.id;
  }
  inventorySprite: HTMLImageElement = ImageLoader.createImage(this.inventoryImage);

  get itemName(): ItemName {
    return ItemName.AMULET_OF_BLOOD_FURY;
  }
  get weight(): number {
    return 0.02;
  }

  get inventoryImage() {
    return InventImage;
  }

  constructor() {
    super();
    this.bonuses = {
      attack: {
        stab: 10,
        slash: 10,
        crush: 10,
        magic: 10,
        range: 10,
      },
      defence: {
        stab: 15,
        slash: 15,
        crush: 15,
        magic: 15,
        range: 15,
      },
      other: {
        meleeStrength: 8,
        rangedStrength: 0,
        magicDamage: 0.0,
        prayer: 5,
      },
      targetSpecific: {
        undead: 0,
        slayer: 0,
      },
    };
  }
}
