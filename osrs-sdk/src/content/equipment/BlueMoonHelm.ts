import { ImageLoader } from "../../sdk/utils/ImageLoader";
import InventImage from "../../assets/images/equipment/Blue_moon_helm.png";
import { ItemName } from "../../sdk/ItemName";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { Helmet } from "../../sdk/gear/Helmet";

export class BlueMoonHelm extends Helmet {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.blueMoonHelm.id;
  }
  inventorySprite: HTMLImageElement = ImageLoader.createImage(this.inventoryImage);

  get itemName(): ItemName {
    return ItemName.BLUE_MOON_HELM;
  }
  get weight(): number {
    return 0.453;
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
        magic: 6,
        range: 0,
      },
      defence: {
        stab: 0,
        slash: 0,
        crush: 10,
        magic: 6,
        range: 0,
      },
      other: {
        meleeStrength: 3,
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
