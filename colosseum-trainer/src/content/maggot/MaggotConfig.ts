/**
 * Maggot King numbers. Sources: OSRS Wiki (Maggot King, Maggot King/Strategies, poisonous/sticky
 * bile, carrion, ur-maggot larvae). Values the wiki doesn't state are marked "assumed".
 */

export const KING_HITPOINTS = 1500;
export const KING_LEVELS = { attack: 200, strength: 250, defence: 200, magic: 200, range: 300 };
export const KING_COMBAT_LEVEL = 741;

/** Ranged/magic max hit (fully blocked by the matching protection prayer). */
export const PROJECTILE_MAX_HIT = 46;
/** Slam max hit; Protect from Melee reduces it to 35. */
export const SLAM_MAX_HIT = 55;
export const SLAM_PROTECTED_MAX_HIT = 35;

/** Attack speed before the first screech, and after it ("increases by 1 tick"). Assumed 6 -> 5. */
export const ATTACK_SPEED_INITIAL = 6;
export const ATTACK_SPEED_AFTER_SCREECH = 5;

/** Ranged/magic attacks (or slams) between screeches. */
export const ATTACKS_BETWEEN_SCREECH = { min: 4, max: 8 };

/** Screech: up to three ticks of 15-25 damage while a protection prayer is on. */
export const SCREECH_TICKS = 3;
export const SCREECH_DAMAGE = { min: 15, max: 25 };
/** Defence level while screeching (halved from 200). */
export const SCREECH_DEFENCE = 100;

/** Carrion: initial piles hit up to 25, the splatter around them up to 10. */
export const CARRION_MAX_HIT = 25;
export const CARRION_SPLATTER_MAX_HIT = 10;
export const CARRION_PILES = { min: 5, max: 8 }; // assumed
export const CARRION_FALL_TICKS = 3; // assumed (shadows show first)
export const CARRION_SPLATTER_TICKS = 1; // assumed

/** Bile damage when stepped on. Poisonous bile "minor"; sticky bile 2-4 (disease). */
export const POISON_BILE_DAMAGE = { min: 1, max: 3 }; // assumed "minor"
export const STICKY_BILE_DAMAGE = { min: 2, max: 4 };
export const RANGED_POISON_START = 8;

/** HP thresholds. */
export const MELEE_THRESHOLD = 980; // ~65%: melee becomes possible, slams join the rotation
export const LARVAE_THRESHOLD = 1250; // ~83%: each screech launches a larva
export const MULTI_LARVAE_THRESHOLD = 299; // ~19%: up to four at once
export const ENRAGE_THRESHOLD = 305; // ~20%: stays at the wall, melee only

/** Larvae: 30 HP, chip 3 then +1 each tick once they reach you. */
export const LARVA_HITPOINTS = 30;
export const LARVA_FLIGHT_TICKS = 4; // assumed
export const LARVA_CHIP_START = 3;

/** Fire spells: +5 burn per hit and -20 magic defence per stack, max 5 stacks. */
export const BURN_DAMAGE = 5;
export const BURN_MAGIC_DEFENCE_DROP = 20;
export const BURN_MAX_STACKS = 5;

/** Magic defence rises from +150 to +400 while it's at the wall for slams. */
export const MAGIC_DEFENCE_NORMAL = 150;
export const MAGIC_DEFENCE_MELEE_PHASE = 400;

/** Melee punish: crush defence roll reduced by 85%, +50% damage. */
export const PUNISH_DEFENCE_ROLL = 0.15;
export const PUNISH_DAMAGE = 1.5;

/** Ticks between the head extending (telegraph) and the slam landing. Assumed. */
export const SLAM_WINDUP_TICKS = 2;
