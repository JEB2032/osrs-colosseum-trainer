import SeaTurtleImage from "../../assets/images/potions/Sea_turtle.png";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { Food } from "../../sdk/gear/Food";
import { ItemName } from "../../sdk/ItemName";
import { ImageLoader } from "../../sdk/utils/ImageLoader";

export class SeaTurtle extends Food {
  healAmount = 21;
  get cacheItemId(): number {
    return CACHE_ASSETS.items.seaTurtle.id;
  }
  inventorySprite: HTMLImageElement = ImageLoader.createImage(SeaTurtleImage);
  get inventoryImage() {
    return SeaTurtleImage;
  }
  get itemName(): ItemName {
    return ItemName.SEA_TURTLE;
  }
  get weight(): number {
    return 0.65;
  }
}
