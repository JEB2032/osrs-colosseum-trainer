import InventImage from "../../assets/images/weapons/Blue_moon_spear.png";
import { MeleeWeapon } from "../../sdk/weapons/MeleeWeapon";
import { ItemName } from "../../sdk/ItemName";
import { AttackStyle, AttackStyleTypes } from "../../sdk/AttackStylesController";
import { BarrageSpell } from "../../sdk/weapons/BarrageSpell";
import { BloodBarrageSpell } from "../../sdk/weapons/BloodBarrageSpell";
import { AttackBonuses } from "../../sdk/gear/Weapon";
import { Unit } from "../../sdk/Unit";
import { CACHE_ASSETS } from "../../assets/CacheAssets";

/** Blue Moon spear: a 5-tick spear that can autocast (here: Blood Barrage, 10 tiles). */
export class BlueMoonSpear extends MeleeWeapon {
  override get equipSoundId(): number {
    return CACHE_ASSETS.sounds.equipStaff.id;
  }

  get cacheItemId(): number {
    return CACHE_ASSETS.items.blueMoonSpear.id;
  }

  autocastSpell: BarrageSpell = new BloodBarrageSpell();

  constructor() {
    super();
    this.bonuses = {
      attack: {
        stab: 70,
        slash: 62,
        crush: 62,
        magic: 30,
        range: 0,
      },
      defence: {
        stab: 2,
        slash: 3,
        crush: 1,
        magic: 15,
        range: 0,
      },
      other: {
        meleeStrength: 71,
        rangedStrength: 0,
        magicDamage: 0.05,
        prayer: 0,
      },
      targetSpecific: {
        undead: 0,
        slayer: 0,
      },
    };
  }

  attack(from: Unit, to: Unit, bonuses: AttackBonuses = {}): boolean {
    if (this.attackStyle() === AttackStyle.AUTOCAST && from.isPlayer) {
      this.autocastSpell.cast(from, to);
      return true;
    }
    return super.attack(from, to, bonuses);
  }

  attackStyles() {
    return [AttackStyle.ACCURATE, AttackStyle.AGGRESSIVESLASH, AttackStyle.DEFENSIVE, AttackStyle.AUTOCAST];
  }

  attackStyleCategory(): AttackStyleTypes {
    return AttackStyleTypes.STAFF;
  }

  defaultStyle(): AttackStyle {
    return AttackStyle.AUTOCAST;
  }

  get weight(): number {
    return 3.0;
  }

  get itemName(): ItemName {
    return ItemName.BLUE_MOON_SPEAR;
  }

  get isTwoHander(): boolean {
    return true;
  }

  hasSpecialAttack(): boolean {
    return false;
  }

  get attackRange() {
    return this.attackStyle() === AttackStyle.AUTOCAST ? 10 : 1;
  }

  get attackSpeed() {
    return 5;
  }

  get inventoryImage() {
    return InventImage;
  }
}
