import { AttackStyle, AttackStyleTypes } from "../../sdk/AttackStylesController";
import { AttackBonuses } from "../../sdk/gear/Weapon";
import { ItemName } from "../../sdk/ItemName";
import { Unit } from "../../sdk/Unit";
import { MagicWeapon } from "../../sdk/weapons/MagicWeapon";
import { MeleeWeapon } from "../../sdk/weapons/MeleeWeapon";
import InventImage from "../../assets/images/weapons/Slayers_staff_e.png";
import { CACHE_ASSETS } from "../../assets/CacheAssets";
import { isDemonTarget } from "./demonbane";

/** Superior Demonbane (Arceuus): base max hit 23, +20% accuracy, demons only. */
export class SuperiorDemonbaneSpell extends MagicWeapon {
  override get isDemonbane() {
    return true;
  }

  get itemName(): ItemName {
    return ItemName.SUPERIOR_DEMONBANE;
  }

  get attackRange() {
    return 10;
  }

  get attackSpeed() {
    return 5;
  }

  cast(from: Unit, to: Unit) {
    if (!isDemonTarget(to)) return false;
    return this.attack(from, to, { magicBaseSpellDamage: 23, attackStyle: "magic", gearMageMultiplier: 1.2 });
  }
}

/** Slayer's staff (e), autocasting Superior Demonbane. */
export class SlayersStaffE extends MeleeWeapon {
  override get equipSoundId(): number {
    return CACHE_ASSETS.sounds.equipStaff.id;
  }

  get cacheItemId(): number {
    return CACHE_ASSETS.items.slayersStaffE.id;
  }

  autocastSpell = new SuperiorDemonbaneSpell();

  override get isDemonbane() {
    return this.attackStyle() === AttackStyle.AUTOCAST;
  }

  constructor() {
    super();
    this.bonuses = {
      attack: { stab: 7, slash: -1, crush: 25, magic: 12, range: 0 },
      defence: { stab: 2, slash: 3, crush: 1, magic: 10, range: 0 },
      other: { meleeStrength: 35, rangedStrength: 0, magicDamage: 0, prayer: 0 },
      targetSpecific: { undead: 0, slayer: 0 },
    };
  }

  attack(from: Unit, to: Unit, bonuses: AttackBonuses = {}): boolean {
    if (this.attackStyle() === AttackStyle.AUTOCAST && from.isPlayer) {
      return this.autocastSpell.cast(from, to) !== false;
    }
    return super.attack(from, to, bonuses);
  }

  attackStyles() {
    return [AttackStyle.ACCURATE, AttackStyle.AGGRESSIVECRUSH, AttackStyle.DEFENSIVE, AttackStyle.AUTOCAST];
  }

  attackStyleCategory(): AttackStyleTypes {
    return AttackStyleTypes.STAFF;
  }

  defaultStyle(): AttackStyle {
    return AttackStyle.AUTOCAST;
  }

  get itemName(): ItemName {
    return ItemName.SLAYERS_STAFF_E;
  }

  get isTwoHander(): boolean {
    return false;
  }

  get attackRange() {
    return this.attackStyle() === AttackStyle.AUTOCAST ? 10 : 1;
  }

  get attackSpeed() {
    return this.attackStyle() === AttackStyle.AUTOCAST ? 5 : 4;
  }

  get weight(): number {
    return 1.95;
  }

  get inventoryImage() {
    return InventImage;
  }
}
