import { Unit } from "../../sdk/Unit";
import { ItemName } from "../../sdk/ItemName";

const BODY = [ItemName.ELITE_VOID_TOP, ItemName.ELITE_VOID_ROBE, ItemName.VOID_KNIGHT_GLOVES];

function wornNames(from: Unit) {
  return [from.equipment.helmet, from.equipment.chest, from.equipment.legs, from.equipment.gloves].map((item) => item?.itemName);
}

/** Elite void with the mage helm: +45% magic accuracy and +5% magic damage. */
export function eliteVoidMageWorn(from: Unit) {
  const worn = wornNames(from);
  return [ItemName.VOID_MAGE_HELM, ...BODY].every((name) => worn.includes(name));
}

/** Void with the melee helm: +10% melee accuracy and strength. */
export function voidMeleeWorn(from: Unit) {
  const worn = wornNames(from);
  return [ItemName.VOID_MELEE_HELM, ...BODY].every((name) => worn.includes(name));
}
