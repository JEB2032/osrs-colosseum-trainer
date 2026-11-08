import { ImageLoader } from "../../sdk/utils/ImageLoader";
import InventImage from "../../assets/images/equipment/Book_of_the_dead.png";
import { ItemName } from "../../sdk/ItemName";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { Offhand } from "../../sdk/gear/Offhand";

export class BookOfTheDead extends Offhand {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.bookOfTheDead.id;
  }
  inventorySprite: HTMLImageElement = ImageLoader.createImage(this.inventoryImage);

  get itemName(): ItemName {
    return ItemName.BOOK_OF_THE_DEAD;
  }
  get weight(): number {
    return 0.2;
  }
  get inventoryImage() {
    return InventImage;
  }

  constructor() {
    super();
    this.bonuses = {
      attack: { stab: 0, slash: 0, crush: 0, magic: 6, range: 0 },
      defence: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      other: { meleeStrength: 0, rangedStrength: 0, magicDamage: 0, prayer: 3 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }
}
