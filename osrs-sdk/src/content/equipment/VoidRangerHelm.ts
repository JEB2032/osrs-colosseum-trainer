import { ImageLoader } from "../../sdk/utils/ImageLoader";
import InventImage from "../../assets/images/equipment/Void_ranger_helm.png";
import { ItemName } from "../../sdk/ItemName";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { Helmet } from "../../sdk/gear/Helmet";

export class VoidRangerHelm extends Helmet {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.voidRangerHelm.id;
  }
  inventorySprite: HTMLImageElement = ImageLoader.createImage(this.inventoryImage);

  get itemName(): ItemName {
    return ItemName.VOID_RANGER_HELM;
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
      attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      defence: { stab: 6, slash: 6, crush: 6, magic: 6, range: 6 },
      other: { meleeStrength: 0, rangedStrength: 0, magicDamage: 0, prayer: 0 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }
}
