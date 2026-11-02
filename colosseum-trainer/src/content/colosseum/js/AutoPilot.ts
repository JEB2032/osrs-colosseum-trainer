import { LineOfSight, Mob, Pathing, Trainer } from "osrs-sdk";
import type { Item, Player, Region } from "osrs-sdk";

type Tile = { x: number; y: number };

// Kill order: frems first (melee, then mage, then range), then the mage reinforcement.
const PRIORITY: Record<string, number> = {
  "fremennik warband berserker": 0,
  "fremennik warband seer": 1,
  "fremennik warband archer": 2,
  "serpent shaman": 3,
};
const DEFAULT_PRIORITY = 4;

const EAT_BELOW_HP = 65;
// Out of brews: fight with the Blue Moon spear's Blood Barrage (heals 25% of damage) until healthy.
const SUSTAIN_ENTER_HP = 75;
const SUSTAIN_EXIT_HP = 92;
const BOW = "Bow of faerdhinen";
const SPEAR = "Blue Moon spear";
// Eat sooner when several mobs can hit you at once.
const EAT_BELOW_HP_UNDER_PRESSURE = 80;
const RESTORE_BELOW_PRAYER = 30;
// Let the frems and south spawns come to the A/B tile before moving anywhere.
const OPENING_HOLD_TICKS = 25;
// Ticks with nothing to attack before repositioning to solve a stack.
const IDLE_BEFORE_REPOSITION = 3;
const SEARCH_RADIUS = 8;
const MAX_TRAVEL_TICKS = 8;
// A target whose HP hasn't gone down for this long (e.g. being healed) is set aside for a while.
const STALL_TICKS = 15;
const SET_ASIDE_TICKS = 40;
// Minotaur heal rule (see Minotaur.ts): heals mobs under 75% within 7 tiles / LoS of its centre.
const MINOTAUR_HEAL_RANGE = 7;

export type AutoPilotInput = {
  region: Region;
  player: Player;
  phase: "waiting" | "countdown" | "active";
  waveTick: number;
  tossTiles: Tile[];
  /** Still running the opening to A/B: don't start attacking yet. */
  holdPosition: boolean;
};

function liveMobs(region: Region): Mob[] {
  return ([...region.mobs, ...region.newMobs] as Mob[]).filter(
    (mob) => mob instanceof Mob && mob.dying < 0 && mob.currentStats.hitpoint > 0 && mob.visible(),
  );
}

function priority(mob: Mob) {
  return PRIORITY[mob.mobName().toLowerCase()] ?? DEFAULT_PRIORITY;
}

/** Mob can attack the tile from where it stands. */
function threatens(region: Region, mob: Mob, tile: Tile) {
  return LineOfSight.hasLineOfSight(region, mob.location.x, mob.location.y, tile.x, tile.y, mob.size, mob.attackRange, true);
}

/** Player standing on the tile can attack the mob without moving. */
function canHitFrom(region: Region, tile: Tile, mob: Mob, range: number) {
  return LineOfSight.playerHasLineOfSightOfMob(region, tile.x, tile.y, mob, range);
}

/** A minotaur that would heal this mob back up (player not in its melee range, mob in its heal LoS). */
function healerOf(region: Region, mobs: Mob[], target: Mob, player: Player): Mob | null {
  if (target.size % 2 === 0) return null;
  const offset = (target.size - 1) / 2;
  return mobs.find((mob) => {
    if (mob === target || mob.mobName() !== "Minotaur") return false;
    const { x, y } = player.location;
    const playerInMelee = x >= mob.location.x - 1 && x <= mob.location.x + mob.size
      && y <= mob.location.y + 1 && y >= mob.location.y - mob.size;
    if (playerInMelee) return false;
    return LineOfSight.hasLineOfSight(
      region, mob.location.x + 1, mob.location.y - 1,
      target.location.x + offset, target.location.y - offset, 1, MINOTAUR_HEAL_RANGE, false,
    );
  }) ?? null;
}

function findItem(player: Player, name: string): Item | null {
  return player.inventory.find((item) => item && item.itemName === name) ?? null;
}

/**
 * Demo player for waves 10/11 on the A/B method: picks targets, switches to the bow, drinks,
 * dodges javelins and repositions to split stacks. Runs at the end of each tick from game state
 * only, so a recorded run replays identically.
 */
export class AutoPilot {
  private prepared = false;
  private idleTicks = 0;
  private destination: Tile | null = null;
  private travelTicks = 0;
  private tick_ = 0;
  private stall: { target: Mob; bestHp: number; since: number } | null = null;
  private setAside = new Map<Mob, number>();
  private sustaining = false;
  /** What the demo is doing and why, for the coach panel. */
  status = "";

  tick({ region, player, phase, waveTick, tossTiles, holdPosition }: AutoPilotInput) {
    if (player.dying >= 0) return;
    if (phase === "waiting") return;
    this.tick_++;

    if (!this.prepared) {
      this.status = "Switching to the bow and drinking a ranging potion";
      this.prepare(player);
      return;
    }
    if (phase !== "active") return;

    const threats = liveMobs(region).filter((mob) => threatens(region, mob, player.location)).length;
    this.useSupplies(player, threats);
    this.chooseWeapon(player);

    const here = player.location;
    if (tossTiles.some((tile) => tile.x === here.x && tile.y === here.y)) {
      this.status = "Stepping off the javelin landing tile";
      this.dodge(region, player);
      return;
    }

    if (holdPosition) {
      this.status = "Running the A/B opening";
      return;
    }

    const mobs = liveMobs(region);
    const range = player.attackRange;
    const hittable = mobs.filter((mob) => canHitFrom(region, here, mob, range) && !this.isSetAside(mob));
    let target = hittable
      .sort((a, b) => priority(a) - priority(b) || a.currentStats.hitpoint - b.currentStats.hitpoint)[0];
    // Don't feed a minotaur's heal: shoot the minotaur first if it can heal our target.
    let reason = "";
    if (target) {
      const healer = healerOf(region, mobs, target, player);
      if (healer && hittable.includes(healer)) {
        reason = ` first: it would heal the ${target.mobName()}`;
        target = healer;
      }
    }

    if (target) {
      if (this.isStalled(target)) {
        this.setAside.set(target, this.tick_ + SET_ASIDE_TICKS);
        this.stall = null;
        this.idleTicks = IDLE_BEFORE_REPOSITION;
      } else {
        this.idleTicks = 0;
        this.destination = null;
        const using = this.sustaining ? " with Blood Barrage to heal (out of brews)" : "";
        this.status = `Attacking the ${target.mobName()}${using}${reason}`;
        if (player.aggro !== target) Trainer.clickController.playerAttackClick(target);
        return;
      }
    }

    if (mobs.length === 0) {
      this.status = "Wave cleared";
      return;
    }
    if (waveTick < OPENING_HOLD_TICKS) {
      this.status = "Waiting on the tile for mobs to come round the pillar";
      return;
    }
    if (this.destination) {
      this.status = "Moving to split the stack";
      const arrived = here.x === this.destination.x && here.y === this.destination.y;
      if (!arrived && ++this.travelTicks < MAX_TRAVEL_TICKS) return;
      this.destination = null;
    }
    if (++this.idleTicks < IDLE_BEFORE_REPOSITION) {
      this.status = "Nothing in line of sight: waiting";
      return;
    }
    this.reposition(region, player, mobs, range);
  }

  private isSetAside(mob: Mob) {
    const until = this.setAside.get(mob);
    return until !== undefined && until > this.tick_;
  }

  /** True when the target's HP hasn't gone below its best for STALL_TICKS (healed or unhittable). */
  private isStalled(target: Mob) {
    const hp = target.currentStats.hitpoint;
    if (!this.stall || this.stall.target !== target || hp < this.stall.bestHp) {
      this.stall = { target, bestHp: hp, since: this.tick_ };
      return false;
    }
    return this.tick_ - this.stall.since >= STALL_TICKS;
  }

  /** During the countdown: bow in hand, ranging potion down. */
  private prepare(player: Player) {
    const bow = findItem(player, "Bow of faerdhinen");
    if (bow) {
      bow.inventoryLeftClick(player);
      return;
    }
    const ranging = findItem(player, "Ranging potion");
    if (ranging && player.eats.canDrinkPotion()) ranging.inventoryLeftClick(player);
    this.prepared = true;
  }

  /** Bow normally; the Blood Barrage spear for healing once the brews are gone. */
  private chooseWeapon(player: Player) {
    const brewsLeft = player.inventory.some((item) => item && item.itemName === "Saradomin Brew");
    const hp = player.currentStats.hitpoint;
    if (!brewsLeft && hp < SUSTAIN_ENTER_HP) this.sustaining = true;
    else if (brewsLeft || hp >= SUSTAIN_EXIT_HP) this.sustaining = false;
    const wanted = this.sustaining ? SPEAR : BOW;
    if (player.equipment.weapon?.itemName === wanted) return;
    const weapon = findItem(player, wanted);
    if (!weapon) return;
    const target = player.aggro;
    weapon.inventoryLeftClick(player);
    // Switching weapons drops the target; carry on attacking it.
    if (target && target.dying < 0) Trainer.clickController.playerAttackClick(target);
  }

  private useSupplies(player: Player, threats: number) {
    if (!player.eats.canDrinkPotion()) return;
    const { hitpoint, prayer, range } = player.currentStats;
    if (hitpoint < EAT_BELOW_HP || (threats >= 2 && hitpoint < EAT_BELOW_HP_UNDER_PRESSURE)) {
      findItem(player, "Saradomin Brew")?.inventoryLeftClick(player);
    } else if (prayer < RESTORE_BELOW_PRAYER || range < player.stats.range) {
      findItem(player, "Super Restore")?.inventoryLeftClick(player);
    }
  }

  /** Step off a javelin landing tile, to whichever neighbour the fewest mobs can see. */
  private dodge(region: Region, player: Player) {
    const mobs = liveMobs(region);
    let best: Tile | null = null;
    let bestThreats = Infinity;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const tile = { x: player.location.x + dx, y: player.location.y + dy };
      if (!Pathing.canTileBePathedTo(region, tile.x, tile.y, 1, true)) continue;
      const threats = mobs.filter((mob) => threatens(region, mob, tile)).length;
      if (threats < bestThreats) {
        best = tile;
        bestThreats = threats;
      }
    }
    if (best) player.moveTo(best.x, best.y);
  }

  /**
   * Stack solving: go to the nearby tile where we can hit at least one mob while as few as
   * possible can hit us (ideally exactly the one we're shooting).
   */
  private reposition(region: Region, player: Player, mobs: Mob[], range: number) {
    const from = player.location;
    let best: Tile | null = null;
    let bestScore = Infinity;
    for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx++) {
      for (let dy = -SEARCH_RADIUS; dy <= SEARCH_RADIUS; dy++) {
        const tile = { x: from.x + dx, y: from.y + dy };
        if (!Pathing.canTileBePathedTo(region, tile.x, tile.y, 1, true)) continue;
        if (!mobs.some((mob) => !this.isSetAside(mob) && canHitFrom(region, tile, mob, range))) continue;
        const threats = mobs.filter((mob) => threatens(region, mob, tile)).length;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        const score = threats * 20 + (threats > 1 ? 100 : 0) + distance;
        if (score < bestScore) {
          best = tile;
          bestScore = score;
        }
      }
    }
    if (!best) {
      // Nothing reachable to shoot from: walk at the closest mob to pull it round.
      const nearest = [...mobs].sort((a, b) =>
        Math.max(Math.abs(a.location.x - from.x), Math.abs(a.location.y - from.y)) -
        Math.max(Math.abs(b.location.x - from.x), Math.abs(b.location.y - from.y)))[0];
      if (nearest) Trainer.clickController.playerAttackClick(nearest);
      return;
    }
    this.status = "Moving to a tile where only one mob can reach you";
    this.destination = best;
    this.travelTicks = 0;
    this.idleTicks = 0;
    player.moveTo(best.x, best.y);
  }
}
