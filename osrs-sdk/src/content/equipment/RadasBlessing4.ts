import { ImageLoader } from "../../sdk/utils/ImageLoader";
import InventImage from "../../assets/images/equipment/Radas_blessing_4.png";
import { ItemName } from "../../sdk/ItemName";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { Ammo, AmmoType } from "../../sdk/gear/Ammo";

export class RadasBlessing4 extends Ammo {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.radasBlessing4.id;
  }
  inventorySprite: HTMLImageElement = ImageLoader.createImage(this.inventoryImage);

  get itemName(): ItemName {
    return ItemName.RADAS_BLESSING_4;
  }
  get weight(): number {
    return 0.453;
  }

  get inventoryImage() {
    return InventImage;
  }

  ammoType(): AmmoType {
    return AmmoType.BLESSING;
  }

  constructor() {
    super();
    this.bonuses = {
      attack: {
        stab: 0,
        slash: 0,
        crush: 0,
        magic: 0,
        range: 0,
      },
      defence: {
        stab: 0,
        slash: 0,
        crush: 0,
        magic: 0,
        range: 0,
      },
      other: {
        meleeStrength: 0,
        rangedStrength: 0,
        magicDamage: 0.0,
        prayer: 2,
      },
      targetSpecific: {
        undead: 0,
        slayer: 0,
      },
    };
  }
}
