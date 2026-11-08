import { Unit } from "../../sdk/Unit";
import { ItemName } from "../../sdk/ItemName";

/** Units with the demon attribute (e.g. the Doom of Mokhaiotl and its larvae) set this. */
export function isDemonTarget(to: Unit) {
  return !!(to as unknown as { isDemon?: boolean }).isDemon;
}

const ELITE_VOID_RANGED = [ItemName.VOID_RANGER_HELM, ItemName.ELITE_VOID_TOP, ItemName.ELITE_VOID_ROBE, ItemName.VOID_KNIGHT_GLOVES];

/**
 * Elite void ranged: +10% accuracy and +12.5% damage. The engine's void multiplier scales both
 * accuracy and strength, so the remaining damage is applied on top.
 */
export function eliteVoidRangedMultipliers(from: Unit) {
  const worn = [from.equipment.helmet, from.equipment.chest, from.equipment.legs, from.equipment.gloves]
    .map((item) => item?.itemName);
  const full = ELITE_VOID_RANGED.every((name) => worn.includes(name));
  return full ? { accuracy: 1.1, damageAfterAccuracy: 1.125 / 1.1 } : { accuracy: 1, damageAfterAccuracy: 1 };
}
