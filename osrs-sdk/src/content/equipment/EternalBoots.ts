import { ImageLoader } from "../../sdk/utils/ImageLoader";
import InventImage from "../../assets/images/equipment/Eternal_boots.png";
import { ItemName } from "../../sdk/ItemName";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { Feet } from "../../sdk/gear/Feet";

export class EternalBoots extends Feet {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.eternalBoots.id;
  }
  inventorySprite: HTMLImageElement = ImageLoader.createImage(this.inventoryImage);

  get itemName(): ItemName {
    return ItemName.ETERNAL_BOOTS;
  }
  get weight(): number {
    return 1.814;
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
        magic: 8,
        range: 0,
      },
      defence: {
        stab: 5,
        slash: 5,
        crush: 5,
        magic: 8,
        range: 5,
      },
      other: {
        meleeStrength: 0,
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
