import { CACHE_ASSETS } from "osrs-sdk";
import type { Loadout } from "osrs-sdk";

const I = CACHE_ASSETS.items;

/** The setup from the user's "Equip your character" screenshot (stats verified against the wiki). */
export const maggotLoadout: Loadout = {
  name: "Maggot King (void mage + bludgeon)",
  equipment: {
    weapon: I.twinflameStaff.id,
    offhand: I.bookOfDarkness.id,
    helmet: I.voidMageHelm.id,
    necklace: I.occultNecklace.id,
    cape: I.imbuedZamorakCape.id,
    ammo: I.warBlessing.id,
    chest: I.eliteVoidTop.id,
    legs: I.eliteVoidRobe.id,
    feet: I.araneaBoots.id,
    gloves: I.voidKnightGloves.id,
    ring: I.berserkerRingI.id,
  },
  inventory: [
    I.amuletOfFury.id, I.abyssalBludgeon.id, null, I.crystalBow.id,
    I.fireCape.id, I.voidMeleeHelm.id, I.burningClaws.id, I.prayerPotion.id,
    I.prayerPotion.id, I.prayerPotion.id, I.superCombatPotion.id, I.seaTurtle.id,
    I.seaTurtle.id, I.seaTurtle.id, I.seaTurtle.id, I.seaTurtle.id,
    I.seaTurtle.id, I.seaTurtle.id, I.seaTurtle.id, I.cookedKarambwan.id,
    I.cookedKarambwan.id, I.cookedKarambwan.id, I.cookedKarambwan.id, I.cookedKarambwan.id,
    I.cookedKarambwan.id, I.cookedKarambwan.id,
    // Teleport tablets and the rune pouch have no use in the sim.
    null, null,
  ],
};
