/**
 * Doom of Mokhaiotl numbers per delve level, from the OSRS Wiki (Doom of Mokhaiotl and its
 * Strategies page). Values marked "assumed" are not documented and are best guesses.
 */
export type DelveLevel = 5 | 6 | 7 | 8;

export type DelveConfig = {
  hitpoints: number;
  combatLevel: number;
  /** Standard orb max hit. */
  orbMaxHit: number;
  /** Ticks between attacks. */
  attackSpeed: number;
  /** Standard orb travel time in ticks (assumed: "steadily increases through delve 6"). */
  orbTravelTicks: number;
  /** Projectiles from a Rock Throw (per throw) and number of throws. */
  rockProjectiles: number;
  rockThrows: number;
  /** Ticks from debris landing to the rock projectiles landing. */
  rockProjectileDelay: number;
  shockwaves: number;
  beamDamage: number;
  /** Beam charge time in ticks before it fires (assumed: faster at deeper delves). */
  beamChargeTicks: number;
  /** Larvae per spawn outside the shield phase; giant larvae replace them at delve 8. */
  larvaePerSpawn: number;
  giantLarvae: boolean;
  /** Acid blood tiles splattered per hit. */
  acidTiles: number;
  acidRange: number;
  tramplesDamage: number;
  /** Car phase: zooms, whether it slams, and how fast it moves (tiles per tick). */
  carZooms: number;
  carSlams: boolean;
  carSpeed: number;
  /** Delay to the Doom's next attack after a melee punish. */
  punishDelay: number;
};

export const DELVES: Record<DelveLevel, DelveConfig> = {
  5: {
    hitpoints: 625, combatLevel: 758, orbMaxHit: 53, attackSpeed: 5, orbTravelTicks: 3,
    rockProjectiles: 3, rockThrows: 1, rockProjectileDelay: 1, shockwaves: 3, beamDamage: 80, beamChargeTicks: 12,
    larvaePerSpawn: 2, giantLarvae: false, acidTiles: 3, acidRange: 5, tramplesDamage: 10,
    carZooms: 2, carSlams: false, carSpeed: 4, punishDelay: 7,
  },
  6: {
    hitpoints: 650, combatLevel: 808, orbMaxHit: 55, attackSpeed: 5, orbTravelTicks: 2,
    rockProjectiles: 3, rockThrows: 1, rockProjectileDelay: 1, shockwaves: 3, beamDamage: 99, beamChargeTicks: 11,
    larvaePerSpawn: 2, giantLarvae: false, acidTiles: 3, acidRange: 6, tramplesDamage: 20,
    carZooms: 3, carSlams: true, carSpeed: 4, punishDelay: 7,
  },
  7: {
    hitpoints: 650, combatLevel: 858, orbMaxHit: 57, attackSpeed: 4, orbTravelTicks: 2,
    rockProjectiles: 3, rockThrows: 1, rockProjectileDelay: 2, shockwaves: 4, beamDamage: 99, beamChargeTicks: 10,
    larvaePerSpawn: 2, giantLarvae: false, acidTiles: 3, acidRange: 6, tramplesDamage: 30,
    carZooms: 3, carSlams: true, carSpeed: 5, punishDelay: 6,
  },
  8: {
    hitpoints: 675, combatLevel: 908, orbMaxHit: 65, attackSpeed: 4, orbTravelTicks: 2,
    rockProjectiles: 3, rockThrows: 2, rockProjectileDelay: 2, shockwaves: 5, beamDamage: 99, beamChargeTicks: 9,
    larvaePerSpawn: 1, giantLarvae: true, acidTiles: 4, acidRange: 6, tramplesDamage: 40,
    carZooms: 3, carSlams: true, carSpeed: 8, punishDelay: 6,
  },
};

// Shared numbers (wiki).
export const TONGUE_MAX_HIT = 40;
export const ROCK_DEBRIS_MAX_HIT = 21;
export const ROCK_EXPLODE_TICKS = 7;
export const ROCK_FALL_TICKS = 2; // assumed: shadows show for 2 ticks before debris lands
export const SHOCKWAVE_MIN = 30;
export const SHOCKWAVE_MAX = 42;
export const VOLATILE_EARTH_TICKS = 20;
export const SHIELD_HITPOINTS = 500;
export const LARVA_EXPLOSION_MAX_HIT = 21;
export const ACID_MAX_HIT = 7;
export const SHOCKWAVE_START_TICKS = 100; // "around a minute into the fight"
export const CAR_SLAM_MAX_HIT = 60; // assumed: not documented
export const LARVA_SPAWN_INTERVAL = 30; // assumed
export const SHIELD_LARVA_INTERVAL = 6; // assumed
