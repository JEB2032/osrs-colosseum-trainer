import { ItemName } from "../../sdk/ItemName";
import { ImageLoader } from "../../sdk/utils/ImageLoader";
import OneDose from "../../assets/images/potions/Divine_ranging_potion_1.png";
import TwoDose from "../../assets/images/potions/Divine_ranging_potion_2.png";
import ThreeDose from "../../assets/images/potions/Divine_ranging_potion_3.png";
import FourDose from "../../assets/images/potions/Divine_ranging_potion_4.png";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { RangingPotion } from "./RangingPotion";

/** Divine ranging potion: a ranging potion boost (the 5-minute no-decay isn't simulated). */
export class DivineRangingPotion extends RangingPotion {
  oneDose: HTMLImageElement = ImageLoader.createImage(OneDose);
  twoDose: HTMLImageElement = ImageLoader.createImage(TwoDose);
  threeDose: HTMLImageElement = ImageLoader.createImage(ThreeDose);
  fourDose: HTMLImageElement = ImageLoader.createImage(FourDose);

  get cacheItemId(): number {
    return CACHE_ASSETS.items.divineRangingPotion.id;
  }

  get inventoryImage() {
    if (this.doses === 4) return FourDose;
    if (this.doses === 3) return ThreeDose;
    if (this.doses === 2) return TwoDose;
    return OneDose;
  }

  get itemName(): ItemName {
    return ItemName.DIVINE_RANGING_POTION;
  }
}
