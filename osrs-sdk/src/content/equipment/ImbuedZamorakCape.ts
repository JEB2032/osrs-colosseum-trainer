import { ImageLoader } from "../../sdk/utils/ImageLoader";
import InventImage from "../../assets/images/equipment/Imbued_zamorak_cape.png";
import { ItemName } from "../../sdk/ItemName";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { Cape } from "../../sdk/gear/Cape";

export class ImbuedZamorakCape extends Cape {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.imbuedZamorakCape.id;
  }
  inventorySprite: HTMLImageElement = ImageLoader.createImage(this.inventoryImage);

  get itemName(): ItemName {
    return ItemName.IMBUED_ZAMORAK_CAPE;
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
      attack: { stab: 0, slash: 0, crush: 0, magic: 15, range: 0 },
      defence: { stab: 3, slash: 3, crush: 3, magic: 15, range: 0 },
      other: { meleeStrength: 0, rangedStrength: 0, magicDamage: 0.02, prayer: 0 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }
}
