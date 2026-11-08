import { ItemName } from "../../sdk/ItemName";
import InventImage from "../../assets/images/weapons/Rosewood_blowpipe.png";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { Blowpipe } from "./Blowpipe";

/** Rosewood blowpipe loaded with rune darts (+6 + 14 ranged strength assumed). */
export class RosewoodBlowpipe extends Blowpipe {
  get cacheItemId(): number {
    return CACHE_ASSETS.items.rosewoodBlowpipe.id;
  }

  constructor() {
    super();
    this.bonuses = {
      attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 22 },
      defence: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      other: { meleeStrength: 0, rangedStrength: 20, magicDamage: 0, prayer: 0 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }

  get itemName(): ItemName {
    return ItemName.ROSEWOOD_BLOWPIPE;
  }

  get inventoryImage() {
    return InventImage;
  }
}
