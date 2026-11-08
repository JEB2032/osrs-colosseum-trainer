import * as THREE from "three";

import {
  CacheRenderInstancedModel,
  CacheRenderModel,
  CacheRenderReferences,
  CacheRenderSceneModel,
  CollisionType,
  Entity,
  LineOfSightMask,
  Projectile,
  Random,
  Trainer,
} from "osrs-sdk";
import type { Location, Model, Region } from "osrs-sdk";

import { DOOM_ASSETS } from "../../doomAssets";
import { ACID_MAX_HIT } from "./DoomConfig";

/** Quarter-turn rotation picked once per object, as the client rotates spawned locs. */
function randomQuarterTurn() {
  return Math.floor(Math.random() * 4) * (Math.PI / 2);
}

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

/**
 * The compiled cave scene, minus the flat grey roof sheet the scene compiler emits four tiles
 * above the floor (the game client never draws it; from the fixed camera it shows as grey slabs).
 */
class DoomSceneModel extends CacheRenderSceneModel {
  private roofRemoved = false;

  constructor(sceneId: string) {
    super(sceneId, { elevation: 0, originOffset: { x: 0, y: 0 } });
  }

  override draw(...args: Parameters<CacheRenderSceneModel["draw"]>) {
    super.draw(...args);
    if (!this.roofRemoved) this.removeRoof();
  }

  private removeRoof() {
    const root = (this as unknown as { root: THREE.Group }).root;
    if (!root.children.length) return;
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const position = mesh.geometry.getAttribute("position");
      const color = mesh.geometry.getAttribute("color");
      if (!position || !color || color.itemSize !== 4) return;
      // Only whole triangles lying in the roof plane: wall tops that touch it keep their shape.
      const indices = mesh.geometry.index;
      const vertexAt = (corner: number) => (indices ? indices.getX(corner) : corner);
      const triangles = (indices ? indices.count : position.count) / 3;
      let changed = false;
      for (let triangle = 0; triangle < triangles; triangle++) {
        const corners = [vertexAt(triangle * 3), vertexAt(triangle * 3 + 1), vertexAt(triangle * 3 + 2)];
        if (!corners.every((vertex) => position.getY(vertex) >= 3.99)) continue;
        // Vertex alpha 0 is discarded by the scene material's alphaTest.
        corners.forEach((vertex) => color.setW(vertex, 0));
        changed = true;
      }
      if (changed) color.needsUpdate = true;
    });
    this.roofRemoved = true;
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
    return new DoomSceneModel(`region:${this.regionId}`);
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

  private readonly rotation = randomQuarterTurn();

  get color() {
    return "#6b5a48";
  }

  get drawOutline() {
    return false;
  }

  getPerceivedRotation() {
    return this.rotation;
  }

  create3dModel(): Model {
    return CacheRenderInstancedModel.forRenderable(this, CacheRenderReferences.model(DOOM_ASSETS.models.rock.id));
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
  private readonly rotation = randomQuarterTurn();
  private readonly modelId = Math.random() < 0.5 ? DOOM_ASSETS.models.acidBloodA.id : DOOM_ASSETS.models.acidBloodB.id;

  get size() {
    return 1;
  }

  get color() {
    return "#4fae1f";
  }

  getPerceivedRotation() {
    return this.rotation;
  }

  create3dModel(): Model {
    return CacheRenderInstancedModel.forRenderable(this, CacheRenderReferences.model(this.modelId));
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

  get animationIndex() {
    return 0;
  }

  getPerceivedRotation() {
    return 0;
  }

  create3dModel(): Model {
    return CacheRenderModel.forRenderable(this, CacheRenderReferences.npc(DOOM_ASSETS.npcs.earthenShield.id));
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
