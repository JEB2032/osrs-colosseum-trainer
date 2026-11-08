import AnglerfishImage from "../../assets/images/potions/Anglerfish.png";
import { Food } from "../../sdk/gear/Food";
import { ItemName } from "../../sdk/ItemName";
import { Player } from "../../sdk/Player";
import { ImageLoader } from "../../sdk/utils/ImageLoader";
import { CACHE_ASSETS } from "../../assets/CacheAssets";

/** Anglerfish: heals 22 at 99 Hitpoints and can overheal up to 121. */
export class Anglerfish extends Food {
  healAmount = 22;
  inventorySprite: HTMLImageElement = ImageLoader.createImage(AnglerfishImage);

  get cacheItemId(): number {
    return CACHE_ASSETS.items.anglerfish.id;
  }

  get inventoryImage() {
    return AnglerfishImage;
  }

  get itemName(): ItemName {
    return ItemName.ANGLERFISH;
  }

  get weight(): number {
    return 0.4;
  }

  eat(player: Player) {
    const before = player.currentStats.hitpoint;
    super.eat(player);
    const level = player.stats.hitpoint;
    const heal = Math.floor(level / 10) + (level >= 93 ? 13 : level >= 75 ? 8 : level >= 50 ? 6 : level >= 25 ? 4 : 2);
    player.currentStats.hitpoint = Math.min(before + heal, level + heal);
  }
}
