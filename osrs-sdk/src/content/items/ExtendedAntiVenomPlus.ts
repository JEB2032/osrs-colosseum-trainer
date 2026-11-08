import { ItemName } from "../../sdk/ItemName";
import { ImageLoader } from "../../sdk/utils/ImageLoader";
import OneDose from "../../assets/images/potions/Extended_anti_venom_1.png";
import TwoDose from "../../assets/images/potions/Extended_anti_venom_2.png";
import ThreeDose from "../../assets/images/potions/Extended_anti_venom_3.png";
import FourDose from "../../assets/images/potions/Extended_anti_venom_4.png";
import Vial from "../../assets/images/potions/Vial.png";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { Player } from "../../sdk/Player";
import { Potion } from "../../sdk/gear/Potion";

/** Extended anti-venom+: cures venom and gives venom immunity (3 minutes per dose here). */
export class ExtendedAntiVenomPlus extends Potion {
  oneDose: HTMLImageElement = ImageLoader.createImage(OneDose);
  twoDose: HTMLImageElement = ImageLoader.createImage(TwoDose);
  threeDose: HTMLImageElement = ImageLoader.createImage(ThreeDose);
  fourDose: HTMLImageElement = ImageLoader.createImage(FourDose);

  get cacheItemId(): number {
    return CACHE_ASSETS.items.extendedAntiVenomPlus.id;
  }

  constructor(doses = 4) {
    super();
    this.doses = doses;
    this.updateInventorySprite();
  }

  get inventoryImage() {
    if (this.doses === 4) return FourDose;
    if (this.doses === 3) return ThreeDose;
    if (this.doses === 2) return TwoDose;
    if (this.doses === 1) return OneDose;
    return Vial;
  }

  get itemName(): ItemName {
    return ItemName.EXTENDED_ANTI_VENOM_PLUS;
  }

  drink(player: Player) {
    super.drink(player);
    player.effects.venomed = 0;
    player.effects.antiVenom = 300;
  }

  updateInventorySprite() {
    if (this.doses === 4) this.inventorySprite = this.fourDose;
    else if (this.doses === 3) this.inventorySprite = this.threeDose;
    else if (this.doses === 2) this.inventorySprite = this.twoDose;
    else if (this.doses === 1) this.inventorySprite = this.oneDose;
    else this.inventorySprite = this.vial;
  }
}
