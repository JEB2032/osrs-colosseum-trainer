import { LineOfSight, Manticore } from "osrs-sdk";
import type { Mob, Player, Region } from "osrs-sdk";

import { JavelinColossus } from "./mobs/JavelinColossus";

export type CombatStyle = "magic" | "range" | "melee";

export type IncomingAttack = { style: CombatStyle | "dodge"; source: string; maxHit: number };

export type CoachState = {
  /** Big instruction for right now. */
  instruction: string;
  /** Smaller line under it. */
  detail: string;
  /** Tile to be on / click, if any. */
  targetTile: { x: number; y: number } | null;
  /** Attacks predicted for each of the next ticks (index 0 = next tick). */
  nextTicks: IncomingAttack[][];
  /** Protection prayer needed on the next tick. */
  pray: CombatStyle | null;
  /** More than one style lands on the next tick. */
  conflict: boolean;
};

export const PRAYER_NAMES: Record<CombatStyle, string> = {
  magic: "Protect from Magic",
  range: "Protect from Range",
  melee: "Protect from Melee",
};

export const LOOKAHEAD_TICKS = 6;

// Manticore orb enum order in the SDK: Range, Mage, Melee.
const ORB_STYLES: CombatStyle[] = ["range", "magic", "melee"];
const MANTICORE_ATTACK_SPEED = 10;

type Tile = { x: number; y: number };

export type CoachInput = {
  region: Region;
  player: Player | undefined;
  phase: "waiting" | "countdown" | "active";
  spawnTicksLeft: number;
  waveTick: number;
  startTile: Tile;
  aTile: Tile;
  bTile: Tile;
  aSpawn: Tile;
  bSpawn: Tile;
  tossTiles: Tile[];
};

function styleOfAttack(attackStyle: string): CombatStyle {
  if (attackStyle === "magic") return "magic";
  if (attackStyle === "range") return "range";
  return "melee";
}

function sameTile(a: Tile, b: Tile) {
  return a.x === b.x && a.y === b.y;
}

/** Predicts which styles hit the player on each of the next LOOKAHEAD_TICKS ticks. */
export function predictAttacks(region: Region, player: Player): IncomingAttack[][] {
  const ticks: IncomingAttack[][] = Array.from({ length: LOOKAHEAD_TICKS }, () => []);
  const add = (offset: number, attack: IncomingAttack) => {
    if (offset >= 1 && offset <= LOOKAHEAD_TICKS) ticks[offset - 1].push(attack);
  };

  for (const mob of [...region.mobs, ...region.newMobs] as Mob[]) {
    if (mob.dying >= 0 || mob.aggro !== player || mob.currentStats.hitpoint <= 0) continue;
    const name = mob.mobName();

    if (mob instanceof Manticore) {
      // SDK internals: the charged orb order, and whether it has thrown a volley yet.
      const internals = mob as unknown as { attackStyles: number[] | null; hasAttacked: boolean };
      const orbs = internals.attackStyles;
      if (!orbs) continue;
      const delay = mob.attackDelay;
      // Orbs still to come from a volley thrown in the last two ticks.
      const sinceVolley = MANTICORE_ATTACK_SPEED - delay;
      if (internals.hasAttacked && sinceVolley >= 0 && sinceVolley < 2) {
        for (let orb = sinceVolley + 1; orb <= 2; orb++) {
          add(orb - sinceVolley, { style: ORB_STYLES[orbs[orb]], source: name, maxHit: 36 });
        }
      }
      if (mob.hasLOS) {
        const first = Math.max(1, delay);
        orbs.forEach((orb, index) => add(first + index, { style: ORB_STYLES[orb], source: name, maxHit: 36 }));
      }
      continue;
    }

    const style = styleOfAttack(mob.attackStyleForNewAttack());
    const canHit = style === "melee" ? mob.isWithinMeleeRange() : mob.hasLOS;
    if (!canHit) continue;
    const speed = Math.max(1, mob.attackSpeed);
    let attacksMade = mob instanceof JavelinColossus
      ? (mob as unknown as { attacksMade: number }).attacksMade
      : 0;
    for (let offset = Math.max(1, mob.attackDelay); offset <= LOOKAHEAD_TICKS; offset += speed) {
      attacksMade++;
      const toss = mob instanceof JavelinColossus && attacksMade % 5 === 0;
      // A javelin toss can't be prayed against; it lands 6 ticks later on the tile you were on.
      if (!toss) add(offset, { style, source: name, maxHit: mob.maxHit || 30 });
    }
  }
  return ticks;
}

/** The prayer that blocks the biggest hit landing on the next tick. */
function choosePrayer(next: IncomingAttack[]): { pray: CombatStyle | null; conflict: boolean } {
  const prayable = next.filter((attack) => attack.style !== "dodge") as { style: CombatStyle; maxHit: number }[];
  if (prayable.length === 0) return { pray: null, conflict: false };
  const styles = new Set(prayable.map((attack) => attack.style));
  const biggest = prayable.reduce((best, attack) => (attack.maxHit > best.maxHit ? attack : best));
  return { pray: biggest.style, conflict: styles.size > 1 };
}

/** With manticores on both south spawns, stop early on the start column where both can still see you. */
function doubleManticoreTile(region: Region, input: CoachInput, manticores: Mob[]): Tile {
  for (let y = input.bTile.y; y <= input.startTile.y; y++) {
    const tile = { x: input.startTile.x, y };
    const seenByAll = manticores.every((mob) =>
      LineOfSight.hasLineOfSight(region, mob.location.x, mob.location.y, tile.x, tile.y, mob.size, mob.attackRange, true),
    );
    if (seenByAll) return tile;
  }
  return input.bTile;
}

const STYLE_WORD: Record<CombatStyle, string> = { magic: "MAGE", range: "RANGE", melee: "MELEE" };

export function computeCoach(input: CoachInput): CoachState {
  const { region, player } = input;
  const empty: CoachState = { instruction: "", detail: "", targetTile: null, nextTicks: [], pray: null, conflict: false };
  if (!player || player.dying >= 0) return { ...empty, instruction: "You died", detail: "Watch the replay to see what hit you." };

  if (input.phase === "waiting") {
    const onStart = sameTile(player.location, input.startTile);
    return {
      ...empty,
      instruction: onStart ? "Press Start (Space)" : "Go to the green start tile",
      detail: "NPCs spawn 5 ticks after Start. You'll click B on the spawn tick.",
      targetTile: input.startTile,
    };
  }

  if (input.phase === "countdown") {
    const left = input.spawnTicksLeft;
    return {
      ...empty,
      instruction: left <= 1 ? "CLICK B NOW" : `Spawn in ${left} ticks`,
      detail: left <= 1 ? "Leave the start tile on the tick the NPCs spawn." : "Watch the metronome. Get your mouse over B.",
      targetTile: input.bTile,
    };
  }

  const nextTicks = predictAttacks(region, player);
  const { pray, conflict } = choosePrayer(nextTicks[0]);
  const state: CoachState = { ...empty, nextTicks, pray, conflict };

  // Opening: pick A, B or the double-manticore tile from what spawned south.
  if (input.waveTick <= 12) {
    const manticores = (region.mobs as Mob[]).filter((mob) => mob instanceof Manticore && mob.dying < 0);
    const onA = manticores.find((mob) => sameTile(mob.location, input.aSpawn));
    const onB = manticores.find((mob) => sameTile(mob.location, input.bSpawn));
    let target = input.bTile;
    let instruction = "Run to B";
    let detail = "Both south mobs will come round the corner off-tick.";
    if (onA && onB) {
      target = doubleManticoreTile(region, input, [onA, onB]);
      instruction = "Double manticore: stop on the marked tile";
      detail = "Stay where both can see you, then flick their orbs in order.";
    } else if (onA) {
      target = input.aTile;
      instruction = "Manticore on the A spawn: go to A";
      detail = "One tile further than B. The other mob will be off-tick.";
    } else if (onB) {
      detail = "Manticore on the B spawn: stay on B. The other mob will be off-tick.";
    }
    if (!sameTile(player.location, target) || input.waveTick <= 3) {
      return { ...state, instruction, detail, targetTile: target };
    }
  }

  if (input.tossTiles.some((tile) => sameTile(tile, player.location))) {
    return { ...state, instruction: "MOVE! Javelin landing on you", detail: "Step one tile off the red marker." };
  }
  if (pray) {
    return {
      ...state,
      instruction: `PRAY ${STYLE_WORD[pray]}`,
      detail: conflict
        ? "Two styles hit next tick: praying against the bigger hit."
        : `Next hit: ${nextTicks[0].map((attack) => attack.source).join(", ")}`,
    };
  }
  const nextHit = nextTicks.findIndex((tick) => tick.some((attack) => attack.style !== "dodge"));
  return {
    ...state,
    instruction: nextHit >= 0 ? `Next hit in ${nextHit + 1} ticks` : "Nothing incoming",
    detail: "Let the mobs come round the pillar before you attack.",
  };
}
