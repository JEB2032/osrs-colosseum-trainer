import * as THREE from "three";

import {
  CacheRenderSceneModel,
  CollisionType,
  Entity,
  LineOfSightMask,
  Projectile,
  Random,
  Trainer,
} from "osrs-sdk";
import type { Location, Model, Region } from "osrs-sdk";

import { ACID_MAX_HIT } from "./DoomConfig";

/** Flat tile fill or a box, for hazards the asset tool can't extract as cache objects. */
class TileShapeModel implements Model {
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial | THREE.MeshLambertMaterial;

  constructor(private readonly entity: Entity, private readonly height: number, private readonly alpha: number) {
    const size = entity.size;
    if (height > 0) {
      this.material = new THREE.MeshLambertMaterial({ color: entity.colorHex });
      this.mesh = new THREE.Mesh(new THREE.BoxGeometry(size * 0.9, height, size * 0.9), this.material);
    } else {
      this.material = new THREE.MeshBasicMaterial({ color: entity.colorHex, transparent: true, opacity: alpha, depthWrite: false });
      this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.96, size * 0.96), this.material);
      this.mesh.rotateX(-Math.PI / 2);
    }
  }

  draw(scene: THREE.Scene, _clockDelta: number, tickPercent: number, location: Location) {
    if (this.mesh.parent !== scene) scene.add(this.mesh);
    const size = this.entity.size;
    this.mesh.visible = this.entity.visible(tickPercent);
    this.material.color.setHex(this.entity.colorHex);
    if (this.height <= 0) (this.material as THREE.MeshBasicMaterial).opacity = this.alpha * this.opacityAt(tickPercent);
    // Same tile convention as the Colosseum's SandPoolModel.
    this.mesh.position.set(location.x + size / 2, this.height > 0 ? this.height / 2 - 0.5 : -0.48, location.y - size / 2);
  }

  private opacityAt(tickPercent: number) {
    const opacity = (this.entity as unknown as { opacity?: (t: number) => number }).opacity;
    return opacity ? opacity.call(this.entity, tickPercent) : 1;
  }

  destroy(scene: THREE.Scene) {
    if (this.mesh.parent === scene) scene.remove(this.mesh);
  }

  getWorldPosition() {
    return this.mesh.getWorldPosition(new THREE.Vector3());
  }

  async preload() {
    return;
  }
}

abstract class DoomEntity extends Entity {
  get collisionType() {
    return CollisionType.NONE;
  }

  get lineOfSight() {
    return LineOfSightMask.NONE;
  }

  get drawOutline() {
    return false;
  }
}

/** The cache arena: delves 2-5 use region 13668, delves 6+ region 14180 (floor at base height). */
export class DoomScene extends DoomEntity {
  constructor(region: Region, private readonly regionId: number) {
    super(region, { x: 0, y: 0 });
  }

  get size() {
    return 1;
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
    return new CacheRenderSceneModel(`region:${this.regionId}`, { elevation: 0, originOffset: { x: 0, y: 0 } });
  }
}

/** Solid rock left by Rock Throw / burrowing: blocks movement and the Doom's car slam. */
export class SolidRock extends Entity {
  get collisionType() {
    return CollisionType.BLOCK_MOVEMENT;
  }

  get lineOfSight() {
    return LineOfSightMask.FULL_MASK;
  }

  get size() {
    return 1;
  }

  get color() {
    return "#6b5a48";
  }

  get drawOutline() {
    return false;
  }

  create3dModel(): Model {
    return new TileShapeModel(this, 1.1, 1);
  }
}

/** Looming shadow of falling debris; lands after a short delay. */
export class DebrisShadow extends DoomEntity {
  get size() {
    return 1;
  }

  get color() {
    return "#000000";
  }

  create3dModel(): Model {
    return new TileShapeModel(this, 0, 0.55);
  }
}

/** Acid blood: up to 7 damage each tick you stand in it, and venom. */
export class AcidPool extends DoomEntity {
  onVenom: (() => void) | null = null;

  get size() {
    return 1;
  }

  get color() {
    return "#4fae1f";
  }

  create3dModel(): Model {
    return new TileShapeModel(this, 0, 0.75);
  }

  tick() {
    const player = Trainer.player;
    if (!player || player.dying >= 0) return;
    if (player.location.x === this.location.x && player.location.y === this.location.y) {
      const damage = 1 + Math.floor(Random.get() * ACID_MAX_HIT);
      player.addProjectile(new Projectile(null, damage, player, player, "typeless", { setDelay: 0 }));
      this.onVenom?.();
    }
  }
}

/** Earthen shield: a 3x3 safe zone that walks from the 2nd volatile earth to the 1st. */
export class EarthenShield extends DoomEntity {
  destination: Location;

  constructor(region: Region, location: Location, destination: Location, private readonly ticksPerStep: number) {
    super(region, location);
    this.destination = destination;
  }

  private stepTimer = 0;

  get size() {
    return 3;
  }

  get color() {
    return "#c9a227";
  }

  create3dModel(): Model {
    return new TileShapeModel(this, 0, 0.45);
  }

  get arrived() {
    return this.location.x === this.destination.x && this.location.y === this.destination.y;
  }

  /** Centre tile, which clears acid blood it passes over. */
  get centre() {
    return { x: this.location.x + 1, y: this.location.y - 1 };
  }

  covers(tile: Location) {
    return tile.x >= this.location.x && tile.x < this.location.x + 3 && tile.y <= this.location.y && tile.y > this.location.y - 3;
  }

  tick() {
    if (this.arrived || ++this.stepTimer < this.ticksPerStep) return;
    this.stepTimer = 0;
    // Diagonal first, then straight (wiki).
    this.location = {
      x: this.location.x + Math.sign(this.destination.x - this.location.x),
      y: this.location.y + Math.sign(this.destination.y - this.location.y),
    };
  }
}

/** The burrowed Doom's target marker ("yellow eye"). */
export class CarEye extends DoomEntity {
  get size() {
    return 1;
  }

  get color() {
    return "#ffd400";
  }

  create3dModel(): Model {
    return new TileShapeModel(this, 0, 0.8);
  }
}

/** A volatile earth marker shown while it's attackable. */
export class ArenaBlocker extends Entity {
  get collisionType() {
    return CollisionType.BLOCK_MOVEMENT;
  }

  get lineOfSight() {
    return LineOfSightMask.FULL_MASK;
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
    // invisible wall
  }

  create3dModel() {
    return null;
  }
}
