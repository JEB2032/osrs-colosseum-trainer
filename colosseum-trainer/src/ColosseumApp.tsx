import React, { useEffect, useState, useSyncExternalStore } from "react";
import {
  CacheRender,
  cacheSound,
  ControlPanelController,
  Manticore,
  Renderable,
  Region,
  Settings,
  Sound,
  SoundCache,
  Trainer,
  TrainerInstance,
  TrainerLoadingState,
  Viewport,
} from "osrs-sdk";
import { DefaultSidebar, GameOverlay, LoadoutManager, Modal, RuneScapeButton, RuneScapePanel, TrainerApp, TrainerLoadingSplash, useSettingsStore } from "osrs-sdk-react";
import { ColosseumRegion } from "./content/colosseum/js/ColosseumRegion";
import { ImportedReinforcements, WAVE_COMPOSITIONS, WaveNumber, WavesRegion } from "./content/colosseum/js/WavesRegion";
import { COLOSSEUM_ASSETS } from "./assets";
import { colosseumLoadout, realFightLoadout, wavesLoadout } from "./content/colosseum/js/ColosseumLoadout";
import {
  colosseumSettings,
  ColosseumSettingsState,
} from "./content/colosseum/js/ColosseumSettings";
import { decodePastedLosWaveUrl } from "./content/colosseum/js/LosWaveUrl";
import { formatWaveTime } from "./content/colosseum/js/WaveTimer";
import {
  DOOM_LETHAL_STACKS,
  InvocationState,
  TIERED_INVOCATIONS,
  TOGGLE_INVOCATIONS,
  UNSUPPORTED_INVOCATIONS,
} from "./content/colosseum/js/Invocations";
import { REPLAY_WINDOW_TICKS } from "./content/colosseum/js/ReplayController";

declare const __OSRS_CACHE_RENDER_MANIFEST_URL__: string;

declare global {
  interface Window {
    OSRS_CACHE_RENDER_MANIFEST_URL?: string;
  }
}

const loadoutTemplates = [colosseumLoadout, wavesLoadout, realFightLoadout];
// Waves default to the real-fight setup; the first template is used when none is selected.
const wavesLoadoutTemplates = [realFightLoadout, wavesLoadout, colosseumLoadout];

type TransferredSettings = {
  version: 1;
  hotkeys?: Partial<Record<"inventory" | "spellbook" | "equipment" | "prayer" | "combat", string>>;
  ui?: {
    zoomScale?: number;
    maxUiScale?: number;
    menuVisible?: boolean;
  };
};

function applyTransferredSettings() {
  const encodedSettings = new URLSearchParams(window.location.search).get("settings");
  if (!encodedSettings) return;

  try {
    const base64 = encodedSettings.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), "=");
    const settings = JSON.parse(atob(paddedBase64)) as TransferredSettings;
    if (settings.version !== 1) return;

    const hotkeySettings: Record<
      keyof NonNullable<TransferredSettings["hotkeys"]>,
      "inventory_key" | "spellbook_key" | "equipment_key" | "prayer_key" | "combat_key"
    > = {
      inventory: "inventory_key",
      spellbook: "spellbook_key",
      equipment: "equipment_key",
      prayer: "prayer_key",
      combat: "combat_key",
    };
    for (const [key, setting] of Object.entries(hotkeySettings)) {
      const value = settings.hotkeys?.[key as keyof typeof hotkeySettings];
      if (typeof value === "string" && value.length > 0) Settings[setting] = value;
    }

    if (Number.isFinite(settings.ui?.zoomScale)) {
      Settings.zoomScale = Math.max(0.5, Math.min(2, settings.ui.zoomScale));
    }
    if (Number.isFinite(settings.ui?.maxUiScale)) {
      Settings.maxUiScale = Math.max(0.5, Math.min(2, settings.ui.maxUiScale));
    }
    if (typeof settings.ui?.menuVisible === "boolean") {
      Settings.menuVisible = settings.ui.menuVisible;
    }

    Settings.persistToStorage();
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
  } catch {
    // Ignore malformed or obsolete transfer links and use the saved settings.
  }
}

const TILE_PRESET_KEY = "colosseum-trainer:tile-preset";

/** One-time defaults matching the player's RuneLite Tile Indicators (hovered yellow, true tile cyan). */
function applyTilePreset() {
  try {
    if (window.localStorage.getItem(TILE_PRESET_KEY) === "1") return;
    window.localStorage.setItem(TILE_PRESET_KEY, "1");
  } catch {
    return;
  }
  Settings.set({
    targetTileEnabled: false,
    hoveredTileEnabled: true,
    hoveredTileColor: "#E2D723",
    trueTileEnabled: true,
    trueTileColor: "#00FFFF",
  });
}

function createTrainer() {
  CacheRender.configure(
    __OSRS_CACHE_RENDER_MANIFEST_URL__
      || window.OSRS_CACHE_RENDER_MANIFEST_URL
      || new URL("osrs-assets/manifest.json", window.location.href).href,
  );
  Settings.readFromStorage();
  applyTilePreset();
  applyTransferredSettings();
  colosseumSettings.load();

  const regions: Record<string, Region> = {
    "colosseum.html": new ColosseumRegion(loadoutTemplates),
    "waves.html": new WavesRegion(wavesLoadoutTemplates),
  };
  const regionName = window.location.pathname.split("/").pop() ?? "waves.html";
  const region = regions[regionName] ?? regions["waves.html"];
  const trainer = new TrainerInstance(region, { readyTimer: 5 });
  // Console handle for debugging and automated checks.
  (window as unknown as { colosseum: unknown }).colosseum = { trainer, region, Settings };
  return trainer;
}

type AttackSetting = Exclude<
  keyof ColosseumSettingsState,
  | "forceDoubleSouth"
  | "npcsAggressive"
  | "waveNumber"
  | "showSolarFlareTiles"
  | "solarFlareLevel"
  | "invocations"
  | "showManticoreTimer"
>;

function AttackCheckbox({ label, setting }: { label: string; setting: AttackSetting }) {
  const settings = useSettingsStore(colosseumSettings);
  return (
    <label>
      <input
        type="checkbox"
        checked={settings[setting]}
        onChange={(event) => colosseumSettings.set({ [setting]: event.currentTarget.checked })}
      />
      {label}
      <br />
    </label>
  );
}

function Credits() {
  return (
    <ul>
      <li>Jagex</li>
      <li>Supalosa (engine and logic)</li>
      <li>Tesla Owner (engine)</li>
      <li>KiwiIskadda (detailed feedback)</li>
      <li>Syndra, Varadium, ro0bo, zyth (early feedback and testing)</li>
      <li>@kattykoo on discord (dm for colosseum tips and tricks)</li>
    </ul>
  );
}

function WavesSidebar({ region }: { region: WavesRegion }) {
  const settings = useSettingsStore(colosseumSettings);
  const sdkSettings = useSyncExternalStore(Settings.subscribe, Settings.getSnapshot, Settings.getSnapshot);
  return (
    <>
      <RuneScapeButton type="button" onClick={() => restartRun(region)}>Restart (Ctrl+R)</RuneScapeButton>
      <RuneScapeButton type="button" onClick={() => region.replay.startReplay()}>Replay last 30s</RuneScapeButton>
      <hr />
      <label>
        <input
          type="checkbox"
          checked={sdkSettings.fixedMode}
          onChange={(event) => {
            Settings.set({ fixedMode: event.currentTarget.checked });
            Viewport.viewport?.refreshLayout();
          }}
        />
        Fixed mode client
      </label>
      <br />
      <label>
        <input
          type="checkbox"
          checked={settings.showManticoreTimer}
          onChange={(event) => {
            colosseumSettings.set({ showManticoreTimer: event.currentTarget.checked });
            Manticore.showAttackTimer = event.currentTarget.checked;
          }}
        />
        Manticore charge timer (aid)
      </label>
      <br />
      <label>
        <input
          type="checkbox"
          checked={settings.showMetronome}
          onChange={(event) => colosseumSettings.set({ showMetronome: event.currentTarget.checked })}
        />
        Visual metronome (1–5)
      </label>
      <br />
      <label>
        <input
          type="checkbox"
          checked={settings.showNpcTiles}
          onChange={(event) => {
            colosseumSettings.set({ showNpcTiles: event.currentTarget.checked });
            Renderable.tileHighlightsEnabled = event.currentTarget.checked;
          }}
        />
        NPC tile highlights
      </label>
      <br />
      <label>
        <input
          type="checkbox"
          checked={settings.npcsAggressive}
          onChange={(event) => colosseumSettings.set({ npcsAggressive: event.currentTarget.checked })}
        />
        Aggressive NPCs on wave start
      </label>
      <p style={{ fontSize: 12 }}>
        Green: start tile. Cyan: A tile. Magenta: B tile.
        <br />
        F-keys: open the Settings tab and click a key binding to change it.
      </p>
    </>
  );
}

function restartRun(region: WavesRegion) {
  if (region.replay.isReplaying()) region.replay.exitReplay();
  else Trainer.reset();
}

function InvocationPicker() {
  const settings = useSettingsStore(colosseumSettings);
  const invocations = settings.invocations;
  const set = (patch: Partial<InvocationState>) =>
    colosseumSettings.set({ invocations: { ...invocations, ...patch } });

  return (
    <details style={{ marginTop: 6 }} open={Object.values(invocations).some(Boolean)}>
      <summary style={{ cursor: "pointer" }}>Invocations</summary>
      {TIERED_INVOCATIONS.map(({ key, label, tiers }) => (
        <label key={key} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
          {label}
          <select
            aria-label={label}
            value={Number(invocations[key])}
            onChange={(event) => set({ [key]: Number(event.currentTarget.value) } as Partial<InvocationState>)}
          >
            <option value={0}>Off</option>
            {tiers.map((description, index) => (
              <option key={index} value={index + 1}>{["I", "II", "III"][index]}: {description}</option>
            ))}
          </select>
        </label>
      ))}
      {TOGGLE_INVOCATIONS.map(({ key, label, description }) => (
        <label key={key} title={description} style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={Boolean(invocations[key])}
            onChange={(event) => set({ [key]: event.currentTarget.checked } as Partial<InvocationState>)}
          />
          {label}
        </label>
      ))}
      <p style={{ fontSize: 11, margin: "4px 0 0" }}>Not simulated yet: {UNSUPPORTED_INVOCATIONS.join(", ")}</p>
    </details>
  );
}

function WaveStartModal({ region }: { region: WavesRegion }) {
  const settings = useSettingsStore(colosseumSettings);
  const open = useSyncExternalStore(
    region.subscribeWaveState,
    region.isWaveStartModalOpen,
    region.isWaveStartModalOpen,
  );
  const selectedWave = useSyncExternalStore(
    region.subscribeWaveState,
    region.getSelectedWave,
    region.getSelectedWave,
  );
  const importedReinforcements = useSyncExternalStore(
    region.subscribeWaveState,
    region.getImportedReinforcements,
    region.getImportedReinforcements,
  );
  const imported = region.isLosWaveImport();

  const waveLabels: Record<WaveNumber, string> = {
    1: "Shaman",
    2: "Shaman, Javelin",
    3: "Shaman, 2x Javelin",
    4: "Shaman, Manticore",
    5: "Shaman, Javelin, Manticore",
    6: "Shaman, 2x Javelin, Manticore",
    7: "Javelin, Manticore, Shockwave",
    8: "2x Javelin, Manticore, Shockwave",
    9: "Javelin, 2x Manticore",
    10: "2x Javelin, 2x Manticore",
    11: "Javelin, 2x Manticore, Shockwave",
  };

  return (
    <Modal blocking={false} open={open} aria-label="Start wave">
      <RuneScapePanel style={{ width: 280 }}>
        <h2 style={{ marginTop: 0, textAlign: "center" }}>Double south trainer</h2>
        <p style={{ marginTop: 0, textAlign: "center", fontSize: 12 }}>
          NPCs spawn 5 ticks after Start. Javelin toss and minotaur heal are not simulated yet.
        </p>
        {imported ?
          <>
            <p style={{ marginTop: 0, textAlign: "center", color: 'white' }}>Custom wave imported.</p>
            <label>
              Reinforcements
              <select
                aria-label="Reinforcements"
                value={importedReinforcements}
                onChange={(event) => region.setImportedReinforcements(event.currentTarget.value as ImportedReinforcements)}
              >
                <option value="none">None</option>
                <option value="jaguar">Jaguar Warrior</option>
                <option value="shaman-jaguar">Serpent Shaman + Jaguar Warrior</option>
                <option value="minotaur">Minotaur</option>
                <option value="minotaur-shaman">Minotaur + Serpent Shaman</option>
              </select>
            </label>
          </> :
          <>
            <select
              aria-label="Wave"
              value={selectedWave}
              onChange={(event) => region.setSelectedWave(Number(event.currentTarget.value) as WaveNumber)}
            >
              {(Object.keys(WAVE_COMPOSITIONS) as unknown as WaveNumber[]).map((wave) => (
                <option key={wave} value={wave}>Wave {wave} — {waveLabels[wave]}</option>
              ))}
            </select>
            <label>
              <input
                type="checkbox"
                checked={settings.forceDoubleSouth}
                onChange={(event) => colosseumSettings.set({ forceDoubleSouth: event.currentTarget.checked })}
              />
              Force double south
            </label>
            <InvocationPicker />
          </>
        }
        <RuneScapeButton
          type="button"
          onClick={() => region.requestWaveStart()}
          onMouseEnter={() => SoundCache.play(new Sound(cacheSound(COLOSSEUM_ASSETS.sounds.waveStartStartHover.id), 0.05))}
        >
          Start (Space)
        </RuneScapeButton>
      </RuneScapePanel>
    </Modal>
  );
}

function WaveTimer({ region }: { region: WavesRegion }) {
  const ticks = useSyncExternalStore(
    region.subscribeWaveState,
    region.getWaveTick,
    region.getWaveTick,
  );

  return (
    <div style={{
      bottom: 90,
      color: "white",
      fontFamily: "OSRS",
      fontSize: 24,
      left: 10,
      pointerEvents: "none",
      position: "absolute",
      textShadow: "1px 1px 0 black",
      zIndex: 1,
    }}>
      Wave timer: {formatWaveTime(ticks)}
    </div>
  );
}

function DoomCounter({ region }: { region: WavesRegion }) {
  const settings = useSettingsStore(colosseumSettings);
  const stacks = useSyncExternalStore(region.subscribeWaveState, region.getDoomStacks, region.getDoomStacks);
  if (settings.invocations.doom === 0) return null;
  return (
    <div style={{
      color: "#ff6060",
      fontFamily: "OSRS",
      fontSize: 22,
      left: 10,
      pointerEvents: "none",
      position: "absolute",
      textShadow: "1px 1px 0 black",
      top: 40,
      zIndex: 1,
    }}>
      Doom: {stacks} / {DOOM_LETHAL_STACKS[settings.invocations.doom]}
    </div>
  );
}

const overlayButtonRow: React.CSSProperties = { display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" };

function ReplayOverlay({ region }: { region: WavesRegion }) {
  const replay = useSyncExternalStore(region.replay.subscribe, region.replay.getSnapshot, region.replay.getSnapshot);

  if (replay.mode === "live") {
    if (!replay.hasDeath) return null;
    return (
      <div style={{ left: "50%", position: "absolute", top: 60, transform: "translateX(-50%)", zIndex: 5 }}>
        <RuneScapePanel style={{ width: 300, textAlign: "center" }}>
          <h3 style={{ margin: "0 0 6px" }}>Oh dear, you are dead!</h3>
          <div style={overlayButtonRow}>
            <RuneScapeButton type="button" onClick={() => region.replay.startReplay()}>Watch last 30s</RuneScapeButton>
            <RuneScapeButton type="button" onClick={() => Trainer.reset()}>Restart (Ctrl+R)</RuneScapeButton>
          </div>
        </RuneScapePanel>
      </div>
    );
  }

  const seconds = (ticks: number) => (ticks * 0.6).toFixed(1);
  const relative = replay.tick - replay.fromTick;
  const length = replay.endTick - replay.fromTick;
  return (
    <>
      {/* Swallow clicks on the game while watching. Camera keys still work. */}
      <div style={{ inset: 0, position: "absolute", zIndex: 4 }} onContextMenu={(event) => event.preventDefault()} />
      <div style={replayBar}>
        <span style={{ color: "#ff981f", minWidth: 150 }}>
          REPLAY {seconds(Math.max(0, relative))}s / {seconds(length)}s
        </span>
        <input
          type="range"
          aria-label="Replay position"
          min={replay.fromTick}
          max={replay.endTick}
          value={Math.min(replay.tick, replay.endTick)}
          onChange={(event) => region.replay.seekTo(Number(event.currentTarget.value), true)}
          style={{ flex: 1, minWidth: 120 }}
        />
        <ReplayButton onClick={() => region.replay.seekTo(replay.fromTick, false)} title="Back to start">⏮</ReplayButton>
        <ReplayButton onClick={() => region.replay.seekTo(replay.tick - 5, true)} title="Back 5 ticks">-5</ReplayButton>
        <ReplayButton onClick={() => region.replay.setPaused(!replay.paused)} title="Play/pause (Space)">
          {replay.paused ? "▶" : "❚❚"}
        </ReplayButton>
        <ReplayButton onClick={() => region.replay.step()} disabled={!replay.paused} title="Forward 1 tick">+1</ReplayButton>
        {[0.25, 0.5, 1, 2].map((speed) => (
          <ReplayButton key={speed} onClick={() => region.replay.setSpeed(speed)} active={replay.speed === speed}>
            {speed}x
          </ReplayButton>
        ))}
        <ReplayButton onClick={() => region.replay.exitReplay()} title="Leave replay (Ctrl+R)">Exit</ReplayButton>
      </div>
    </>
  );
}

const replayBar: React.CSSProperties = {
  alignItems: "center",
  background: "rgba(30, 25, 18, 0.92)",
  border: "2px solid #5a5040",
  borderRadius: 4,
  bottom: 8,
  color: "white",
  display: "flex",
  flexWrap: "wrap",
  fontFamily: "OSRS",
  fontSize: 16,
  gap: 4,
  left: "50%",
  maxWidth: "95%",
  padding: "4px 8px",
  position: "absolute",
  transform: "translateX(-50%)",
  width: 640,
  zIndex: 5,
};

function ReplayButton({ active, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      style={{
        background: active ? "#7a2f1a" : "#3e3529",
        border: "1px solid #6b5f4b",
        color: props.disabled ? "#777" : "#ffcf3f",
        cursor: props.disabled ? "default" : "pointer",
        display: "inline-block",
        flex: "0 0 auto",
        fontFamily: "OSRS",
        margin: 0,
        width: "auto",
        fontSize: 15,
        minWidth: 32,
        padding: "2px 6px",
      }}
    />
  );
}

function BossSidebar({ region }: { region: ColosseumRegion }) {
  const settings = useSettingsStore(colosseumSettings);
  return (
    <>
      <span style={{ color: "lime" }}>Right click Sol to skip to specific phases.</span>
      <hr />
      <p>Attack sequence selector:</p>
      <AttackCheckbox label="Shields" setting="useShields" />
      <AttackCheckbox label="Spears" setting="useSpears" />
      <AttackCheckbox label="Triple Parry" setting="useTriple" />
      <AttackCheckbox label="Grapple" setting="useGrapple" />
      <AttackCheckbox label="Phase Transitions" setting="usePhaseTransitions" />

      <p>Solar Flare:</p>
      <select
        aria-label="Solar Flare"
        value={settings.solarFlareLevel}
        onChange={(event) => region.setSolarFlareLevel(Number(event.currentTarget.value))}
      >
        <option value={0}>None</option>
        <option value={1}>Level 1</option>
        <option value={2}>Level 2</option>
        <option value={3}>Level 3</option>
      </select>
      <label>
        <input
          type="checkbox"
          checked={settings.showSolarFlareTiles}
          onChange={(event) => region.setShowSolarFlareTiles(event.currentTarget.checked)}
        />
        Solar Flare Tiles
      </label>
      <br />
    </>
  );
}

function Sidebar({ onLoadoutToggle, region }: { onLoadoutToggle: () => void; region: ColosseumRegion }) {
  const [showCredits, setShowCredits] = useState(false);

  return (
    <div>
      {region instanceof WavesRegion
        ? <WavesSidebar region={region} />
        : <BossSidebar region={region} />}
      <hr />

      <div style={{ paddingBottom: 10, paddingTop: 10, textAlign: "center", width: "100%" }}>
        <div id="gpu_warning" />
      </div>
      <RuneScapeButton type="button" onClick={() => window.location.assign("https://discord.gg/nryYHbvtTa")}>Discord</RuneScapeButton>
      <RuneScapeButton type="button" onClick={() => setShowCredits((visible) => !visible)}>Credits</RuneScapeButton>
      {showCredits && <Credits />}
      <hr />
      <RuneScapeButton type="button" onClick={() => window.location.assign("https://los.colosim.com")}>Line-of-Sight Solver</RuneScapeButton>
      <hr />
      <RuneScapeButton type="button" onClick={() => ControlPanelController.controller.setActiveControl("SETTINGS")}>Settings</RuneScapeButton>
      <RuneScapeButton type="button" onClick={onLoadoutToggle}>Loadout</RuneScapeButton>
    </div>
  );
}

export function ColosseumApp() {
  const [trainer] = useState(createTrainer);
  const [loading, setLoading] = useState<TrainerLoadingState>();
  const [loadoutOpen, setLoadoutOpen] = useState(false);

  const isLoaded = loading?.status === "ready";

  useEffect(() => {
    if (!(trainer.region instanceof WavesRegion)) return;
    const region = trainer.region;
    const onKeyDown = (event: KeyboardEvent) => {
      if (Settings.is_keybinding) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      if (event.ctrlKey && event.key.toLowerCase() === "r") {
        // Like scim.gg: Ctrl+R restarts the run instead of reloading the page.
        event.preventDefault();
        restartRun(region);
      } else if (event.key === " " && region.replay.isReplaying()) {
        event.preventDefault();
        region.replay.setPaused(!region.replay.getSnapshot().paused);
      } else if (event.key === " " && region.isWaveStartModalOpen()) {
        event.preventDefault();
        region.requestWaveStart();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [trainer]);

  useEffect(() => {
    if (!(trainer.region instanceof WavesRegion)) return;
    const region = trainer.region;
    const onPaste = (event: ClipboardEvent) => {
      const imported = decodePastedLosWaveUrl(event.clipboardData?.getData("text/plain") ?? "");
      if (!imported) return;
      event.preventDefault();
      region.importLosWave(imported);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [trainer]);

  return (
    <TrainerApp
      trainer={trainer}
      onLoadingStateChange={setLoading}
    >
      <GameOverlay>
        <div id="disclaimer_panel">Work in progress.<br />All assets are property of Jagex.</div>
        <TrainerLoadingSplash state={loading} />
        {trainer.region instanceof WavesRegion && isLoaded && <WaveTimer region={trainer.region} />}
        {trainer.region instanceof WavesRegion && isLoaded && <WaveStartModal region={trainer.region} />}
        {trainer.region instanceof WavesRegion && isLoaded && <DoomCounter region={trainer.region} />}
        {trainer.region instanceof WavesRegion && isLoaded && <ReplayOverlay region={trainer.region} />}
        <LoadoutManager
          loadouts={loadoutTemplates}
          open={loadoutOpen}
          onClose={() => setLoadoutOpen(false)}
        />
      </GameOverlay>
      <DefaultSidebar>
        <Sidebar
          onLoadoutToggle={() => setLoadoutOpen((open) => !open)}
          region={trainer.region as ColosseumRegion}
        />
      </DefaultSidebar>
    </TrainerApp>
  );
}
