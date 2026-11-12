import type { CacheAssets } from "osrs-sdk/asset-manifest";

/**
 * Maggot King cache requirements (rev 242). IDs are Jagex's named gamevals as published in
 * RuneLite's net.runelite.api.gameval (NpcID / AnimationID / SpotanimID / ObjectID).
 */
export const MAGGOT_ASSETS = {
  npcs: {
    maggotKing: {
      id: 15742,
      animations: {
        screech: 13922,
        melee: 13925,
        walkForwardMelee: 13928,
        walkBackward: 13929,
        walkBackwardMelee: 13930,
        walkRight: 13931,
        walkLeft: 13932,
        range: 13933,
        magic: 13934,
        death: 13936,
      },
    },
    urMaggotLarvae: { id: 15743, animations: { fly: 13914 } },
  },
  regions: {
    // The lair: a 15x4 player strip south of the bone wall (cache x 24-38, y 33-36).
    maggotLair: { id: 11645 },
  },
  spotAnims: {
    poisonProjectile: { id: 1792 },
    screechA: { id: 3793 },
    screechB: { id: 3794 },
    deathVfx: { id: 3795 },
    carrionProjectileBig: { id: 3796 },
    carrionProjectileSmall: { id: 3797 },
    carrionGroundHit: { id: 3798 },
    groundDespawn: { id: 3799 },
    carrionGroundIdle: { id: 3800 },
    carrionGroundDespawn: { id: 3801 },
    venatorProjectile: { id: 3804 },
    venatorImpact: { id: 3805 },
    fireWaveCast: { id: 155 },
    fireWaveTravel: { id: 156 },
    fireWaveImpact: { id: 157 },
  },
  // Object models (ObjectID 33423-33425); the asset tool extracts raw models, not object definitions.
  models: {
    poisonousBile: { id: 61605 },
    stickyBile: { id: 61604 },
    carrion: { id: 61511 },
  },
} as const satisfies CacheAssets;
