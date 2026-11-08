import { CACHE_ASSETS } from "osrs-sdk";
import type { Loadout } from "osrs-sdk";

const I = CACHE_ASSETS.items;

/** The OSRS Wiki's budget setup (Doom of Mokhaiotl/Strategies, Inventory setups → Budget). */
export const doomBudgetLoadout: Loadout = {
  name: "Doom budget (wiki)",
  equipment: {
    weapon: I.scorchingBow.id,
    offhand: null,
    helmet: I.voidRangerHelm.id,
    necklace: I.necklaceOfAnguish.id,
    cape: I.avasAssembler.id,
    ammo: I.amethystArrows.id,
    chest: I.eliteVoidTop.id,
    legs: I.eliteVoidRobe.id,
    feet: I.araneaBoots.id,
    gloves: I.voidKnightGloves.id,
    ring: I.lightbearer.id,
  },
  inventory: [
    I.darklight.id, I.slayersStaffE.id, I.rosewoodBlowpipe.id, I.divineRangingPotion.id,
    I.crystalHalberd.id, I.bookOfTheDead.id, I.anglerfish.id, I.rangingPotion.id,
    I.anglerfish.id, I.anglerfish.id, I.anglerfish.id, I.rangingPotion.id,
    I.saradominBrew.id, I.saradominBrew.id, I.saradominBrew.id, I.saradominBrew.id,
    I.saradominBrew.id, I.saradominBrew.id, I.saradominBrew.id, I.superRestore.id,
    I.superRestore.id, I.superRestore.id, I.superRestore.id, I.superRestore.id,
    // Teleport to house, Pendant of Ates and the divine rune pouch have no use in the sim.
    I.extendedAntiVenomPlus.id, null, null, null,
  ],
};
