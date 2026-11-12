import { ImageLoader } from "../../sdk/utils/ImageLoader";
import InventImage from "../../assets/images/equipment/War_blessing.png";
import { ItemName } from "../../sdk/ItemName";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { Ammo, AmmoType } from "../../sdk/gear/Ammo";

export class WarBlessing extends Ammo {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.warBlessing.id;
  }
  inventorySprite: HTMLImageElement = ImageLoader.createImage(this.inventoryImage);

  get itemName(): ItemName {
    return ItemName.WAR_BLESSING;
  }
  get weight(): number {
    return 0;
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
      attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      defence: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      other: { meleeStrength: 0, rangedStrength: 0, magicDamage: 0, prayer: 1 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }
}
