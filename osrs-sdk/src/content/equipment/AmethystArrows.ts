import { ImageLoader } from "../../sdk/utils/ImageLoader";
import InventImage from "../../assets/images/equipment/Amethyst_arrow.png";
import { ItemName } from "../../sdk/ItemName";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { Ammo, AmmoType } from "../../sdk/gear/Ammo";

export class AmethystArrows extends Ammo {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.amethystArrows.id;
  }
  inventorySprite: HTMLImageElement = ImageLoader.createImage(this.inventoryImage);

  get itemName(): ItemName {
    return ItemName.AMETHYST_ARROWS;
  }
  get weight(): number {
    return 0.0;
  }
  get inventoryImage() {
    return InventImage;
  }

  ammoType(): AmmoType {
    return AmmoType.AMMO;
  }

  constructor() {
    super();
    this.bonuses = {
      attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      defence: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      other: { meleeStrength: 0, rangedStrength: 55, magicDamage: 0, prayer: 0 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }
}
