"use strict";

import {
  createJsonSettingsStorage,
  createSettingsStore,
  SettingsStorage,
} from "osrs-sdk";
import { DEFAULT_INVOCATIONS, InvocationState, sanitizeInvocations } from "./Invocations";

export type ColosseumSettingsState = {
  forceDoubleSouth: boolean;
  npcsAggressive: boolean;
  waveNumber: number;
  showSolarFlareTiles: boolean;
  solarFlareLevel: number;
  useGrapple: boolean;
  usePhaseTransitions: boolean;
  useShields: boolean;
  useSpears: boolean;
  useTriple: boolean;
  invocations: InvocationState;
  /** Trainer aid: draw the manticore's charge countdown (not shown in the real client). */
  showManticoreTimer: boolean;
  /** Visual metronome infobox counting ticks 1-5. */
  showMetronome: boolean;
  /** NPC Indicators-style coloured tiles under each NPC. */
  showNpcTiles: boolean;
  /** Coach overlay: what to click and pray in real time. */
  coach: boolean;
  /** Training wheels: the trainer switches protection prayers for you. */
  autoPray: boolean;
  /** Training wheels: the trainer does the A/B opening movement for you. */
  autoMove: boolean;
  /** Full demo: the trainer plays the whole wave (moves, prays, attacks, drinks, solves stacks). */
  autoFight: boolean;
  /** Live game speed for practice (1 = real time). */
  practiceSpeed: number;
};

const STORAGE_KEY = "colosseum-trainer:settings";
const defaults: ColosseumSettingsState = {
  forceDoubleSouth: true,
  npcsAggressive: true,
  waveNumber: 10,
  showSolarFlareTiles: false,
  solarFlareLevel: 1,
  useGrapple: true,
  usePhaseTransitions: true,
  useShields: true,
  useSpears: true,
  useTriple: true,
  invocations: DEFAULT_INVOCATIONS,
  showManticoreTimer: false,
  showMetronome: true,
  showNpcTiles: true,
  coach: true,
  autoPray: false,
  autoMove: false,
  autoFight: false,
  practiceSpeed: 1,
};

const jsonStorage = createJsonSettingsStorage<ColosseumSettingsState>(STORAGE_KEY, 1);

// Import the trainer's original one-key-per-setting values the first time the
// consolidated store is loaded. The legacy keys can remain for rollback/debugging.
const storage: SettingsStorage<ColosseumSettingsState> = {
  load(fallbacks) {
    if (window.localStorage.getItem(STORAGE_KEY) !== null) {
      const loaded = jsonStorage.load(fallbacks);
      return {
        ...loaded,
        waveNumber: Math.max(1, Math.min(11, Math.trunc(Number(loaded.waveNumber) || fallbacks.waveNumber))),
        invocations: sanitizeInvocations(loaded.invocations),
      };
    }

    const legacySolarFlareLevel = Number.parseInt(
      window.localStorage.getItem("solarFlareLevel") ?? String(fallbacks.solarFlareLevel),
      10,
    );
    const migrated = {
      forceDoubleSouth: true,
      npcsAggressive: true,
      waveNumber: 10,
      showSolarFlareTiles: window.localStorage.getItem("showSolarFlareTiles") === "true",
      solarFlareLevel: Number.isFinite(legacySolarFlareLevel)
        ? legacySolarFlareLevel
        : fallbacks.solarFlareLevel,
      useGrapple: window.localStorage.getItem("useGrapple") !== "false",
      usePhaseTransitions: window.localStorage.getItem("usePhaseTransitions") !== "false",
      useShields: window.localStorage.getItem("useShields") !== "false",
      useSpears: window.localStorage.getItem("useSpears") !== "false",
      useTriple: window.localStorage.getItem("useTriple") !== "false",
      invocations: DEFAULT_INVOCATIONS,
      showManticoreTimer: false,
      showMetronome: true,
      showNpcTiles: true,
      coach: true,
      autoPray: false,
      autoMove: false,
      autoFight: false,
      practiceSpeed: 1,
    };
    jsonStorage.save(migrated);
    return migrated;
  },
  save: jsonStorage.save,
};

export const colosseumSettings = createSettingsStore({ defaults, storage });
