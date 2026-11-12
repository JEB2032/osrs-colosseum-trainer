import { ImageLoader } from "../../sdk/utils/ImageLoader";
import InventImage from "../../assets/images/equipment/Book_of_darkness.png";
import { ItemName } from "../../sdk/ItemName";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { Offhand } from "../../sdk/gear/Offhand";

export class BookOfDarkness extends Offhand {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.bookOfDarkness.id;
  }
  inventorySprite: HTMLImageElement = ImageLoader.createImage(this.inventoryImage);

  get itemName(): ItemName {
    return ItemName.BOOK_OF_DARKNESS;
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
      attack: { stab: 0, slash: 0, crush: 0, magic: 10, range: 0 },
      defence: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      other: { meleeStrength: 0, rangedStrength: 0, magicDamage: 0, prayer: 5 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }
}
