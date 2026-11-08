import type { CacheAssets } from "osrs-sdk/asset-manifest";

/**
 * Doom of Mokhaiotl cache requirements. IDs are Jagex's named gamevals as published in RuneLite's
 * net.runelite.api.gameval (NpcID / AnimationID / SpotanimID / ObjectID): DOM_*.
 */
export const DOOM_ASSETS = {
  npcs: {
    doom: {
      id: 14707,
      animations: {
        idle: 12405,
        standardAttack: 12406,
        rockThrow: 12407,
        beamCharge: 12408,
        beamChargeLoop: 12409,
        beamCancel: 12410,
        beamFire: 12411,
        areaCharge: 12412,
        areaChargeLoop: 12413,
        areaSlam: 12414,
        areaSlamReturn: 12415,
        melee: 12416,
        burrow: 12420,
        burrowIdle: 12421,
        despawn: 12422,
      },
    },
    doomShielded: { id: 14708, animations: { idle: 12405, beamChargeLoop: 12409, beamFire: 12411 } },
    doomBurrowed: {
      id: 14709,
      animations: { movement: 12417, emerge: 12418, explosion: 12419, burrowIdle: 12421 },
    },
    larva: { id: 14710 },
    larvaRange: { id: 14711 },
    larvaMagic: { id: 14712 },
    larvaMelee: { id: 14713 },
    giantLarvaRange: { id: 14788 },
    giantLarvaMagic: { id: 14789 },
    volatileEarth: { id: 14714 },
    earthenShield: { id: 14715 },
  },
  regions: {
    // Instance templates (Blert plugin: MokhaiotlLocation): delves 2-5 and 6+.
    doomMid: { id: 13668 },
    doomDeep: { id: 14180 },
  },
  spotAnims: {
    areaSlam: { id: 3370 },
    burrowedMovement: { id: 3371 },
    burrowedEmerge: { id: 3372 },
    burrowedExplosion: { id: 3373 },
    burrowedExplosionAoe: { id: 3374 },
    burrow: { id: 3375 },
    projectileMelee: { id: 3378 },
    projectileMagic: { id: 3379 },
    projectileRange: { id: 3380 },
    impactMelee: { id: 3381 },
    impactMagic: { id: 3382 },
    impactRange: { id: 3383 },
    rockLaunchRange: { id: 3384 },
    rockLaunchMagic: { id: 3385 },
    rockSplitRange: { id: 3386 },
    rockSplitMagic: { id: 3387 },
    rockDebris: { id: 3388 },
    rockImpact: { id: 3404 },
    beamHead: { id: 3409 },
    beamMiddle: { id: 3410 },
    beamEnd: { id: 3411 },
    beamChargeUp: { id: 3412 },
    beamImpact: { id: 3413 },
  },
  // Object models (ObjectID DOM_*): the asset tool extracts raw models, not object definitions.
  models: {
    acidBloodA: { id: 56409 },
    acidBloodB: { id: 56411 },
    rock: { id: 56496 },
    rubble: { id: 49266 },
  },
  objects: {
    acidPool: { id: 57283 },
    rock: { id: 57286 },
    rockBlockRange: { id: 57287 },
  },
} as const satisfies CacheAssets;
