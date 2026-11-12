import { CacheRenderInstancedModel, CacheRenderReferences, CollisionType, Entity, LineOfSightMask } from "osrs-sdk";
import type { Location, Model, Region } from "osrs-sdk";

import { MAGGOT_ASSETS } from "../../maggotAssets";
import { DoomSceneModel, TileShapeModel } from "../doom/DoomEntities";

/** Quarter-turn rotation picked once per object, as the client rotates spawned locs. Visual only. */
function randomQuarterTurn() {
  return Math.floor(Math.random() * 4) * (Math.PI / 2);
}

abstract class FloorEntity extends Entity {
  get collisionType() {
    return CollisionType.NONE;
  }

  get lineOfSight() {
    return LineOfSightMask.NONE;
  }

  get drawOutline() {
    return false;
  }

  get size() {
    return 1;
  }
}

/** The lair (region 11645) from the cache. */
export class MaggotScene extends FloorEntity {
  constructor(region: Region) {
    super(region, { x: 0, y: 0 });
  }

  get color() {
    return "#000000";
  }

  draw() {
    // the cache scene renders in 3D only
  }

  getPerceivedRotation() {
    return -Math.PI / 2;
  }

  create3dModel(): Model {
    // The player strip's floor is two tiles below the region base height (the king's pen is one).
    return new DoomSceneModel(`region:${MAGGOT_ASSETS.regions.maggotLair.id}`, { elevation: 2, keepRoof: true });
  }
}

export type BileKind = "poison" | "sticky";

/** Bile left by the ranged (green, poisonous) or magic (yellow, sticky) spit. */
export class Bile extends FloorEntity {
  private readonly rotation = randomQuarterTurn();

  constructor(region: Region, location: Location, readonly kind: BileKind) {
    super(region, location);
  }

  get color() {
    return this.kind === "poison" ? "#3f9a2a" : "#d6b42a";
  }

  getPerceivedRotation() {
    return this.rotation;
  }

  create3dModel(): Model {
    const model = this.kind === "poison" ? MAGGOT_ASSETS.models.poisonousBile : MAGGOT_ASSETS.models.stickyBile;
    return CacheRenderInstancedModel.forRenderable(this, CacheRenderReferences.model(model.id));
  }
}

/** A carrion pile on the floor: larvae eat it to heal the king. */
export class Carrion extends FloorEntity {
  private readonly rotation = randomQuarterTurn();

  get color() {
    return "#7a1f1a";
  }

  getPerceivedRotation() {
    return this.rotation;
  }

  create3dModel(): Model {
    return CacheRenderInstancedModel.forRenderable(this, CacheRenderReferences.model(MAGGOT_ASSETS.models.carrion.id));
  }
}

/** Looming shadow where carrion (or its splatter) is about to land. */
export class CarrionShadow extends FloorEntity {
  constructor(region: Region, location: Location, readonly splatter: boolean) {
    super(region, location);
  }

  get color() {
    return "#000000";
  }

  create3dModel(): Model {
    return new TileShapeModel(this, 0, this.splatter ? 0.3 : 0.55);
  }
}

/** Telegraph for the slam's 3x4 area. */
export class SlamMarker extends FloorEntity {
  get color() {
    return "#c0392b";
  }

  create3dModel(): Model {
    return new TileShapeModel(this, 0, 0.22);
  }
}

/** Invisible blocker. The bone wall blocks movement but not projectiles; the arena edge blocks both. */
export class LairBlocker extends Entity {
  constructor(region: Region, location: Location, private readonly blocksSight: boolean) {
    super(region, location);
  }

  get collisionType() {
    return CollisionType.BLOCK_MOVEMENT;
  }

  get lineOfSight() {
    return this.blocksSight ? LineOfSightMask.FULL_MASK : LineOfSightMask.NONE;
  }

  get size() {
    return 1;
  }

  get color() {
    return "#00000000";
  }

  get drawOutline() {
    return false;
  }

  draw() {
    // invisible
  }

  create3dModel() {
    return null;
  }
}
