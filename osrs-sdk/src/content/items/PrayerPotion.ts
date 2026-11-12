import OneDose from "../../assets/images/potions/Prayer_potion_1.png";
import TwoDose from "../../assets/images/potions/Prayer_potion_2.png";
import ThreeDose from "../../assets/images/potions/Prayer_potion_3.png";
import FourDose from "../../assets/images/potions/Prayer_potion_4.png";
import Vial from "../../assets/images/potions/Vial.png";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { ItemName } from "../../sdk/ItemName";
import { Player } from "../../sdk/Player";
import { Potion } from "../../sdk/gear/Potion";
import { ImageLoader } from "../../sdk/utils/ImageLoader";

export class PrayerPotion extends Potion {
  oneDose: HTMLImageElement = ImageLoader.createImage(OneDose);
  twoDose: HTMLImageElement = ImageLoader.createImage(TwoDose);
  threeDose: HTMLImageElement = ImageLoader.createImage(ThreeDose);
  fourDose: HTMLImageElement = ImageLoader.createImage(FourDose);

  get cacheItemId() {
    return CACHE_ASSETS.items.prayerPotion.id;
  }

  constructor(doses = 4) {
    super();
    this.doses = doses;
    this.updateInventorySprite();
  }
  get inventoryImage() {
    if (this.doses === 4) {
      return FourDose;
    } else if (this.doses === 3) {
      return ThreeDose;
    } else if (this.doses === 2) {
      return TwoDose;
    } else if (this.doses === 1) {
      return OneDose;
    }
    return Vial;
  }
  get itemName(): ItemName {
    return ItemName.PRAYER_POTION;
  }

  drink(player: Player) {
    super.drink(player);
    const prayerBonus = Math.floor(player.stats.prayer / 4) + 7;
    player.currentStats.prayer = Math.min(player.currentStats.prayer + prayerBonus, player.stats.prayer);
  }
}
