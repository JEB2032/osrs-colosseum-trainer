import React, { useSyncExternalStore } from "react";
import { Settings, Trainer, Viewport } from "osrs-sdk";
import { Modal, RuneScapeButton, RuneScapePanel } from "osrs-sdk-react";

import { DelveLevel, DELVES } from "./DoomConfig";
import { DoomRegion } from "./DoomRegion";

const DELVE_NOTES: Record<DelveLevel, string> = {
  5: "Car phase arrives: 2 zooms, 10 trample. 3 shockwaves.",
  6: "Car slams (hide behind rocks), 3 zooms, 99 beam.",
  7: "4-tick attacks, faster rock projectiles, 4 shockwaves.",
  8: "Double rock throws, giant larvae, 5 shockwaves, fast car.",
};

export function DoomStartModal({ region }: { region: DoomRegion }) {
  const snapshot = useSyncExternalStore(region.subscribe, region.getSnapshot, region.getSnapshot);
  const open = snapshot.phase === "waiting";
  return (
    <Modal blocking={false} open={open} aria-label="Start delve">
      <RuneScapePanel style={{ width: 300 }}>
        <h2 style={{ marginTop: 0, textAlign: "center" }}>Doom of Mokhaiotl</h2>
        <label style={{ display: "block", textAlign: "center" }}>
          Delve level{" "}
          <select
            aria-label="Delve level"
            value={snapshot.delve}
            onChange={(event) => {
              region.setSelectedDelve(Number(event.currentTarget.value) as DelveLevel);
              // The arena differs from delve 6; rebuild the room for the new level.
              Trainer.reset();
            }}
            style={{ width: "auto", padding: "2px 6px" }}
          >
            {([5, 6, 7, 8] as DelveLevel[]).map((delve) => (
              <option key={delve} value={delve}>{delve} ({DELVES[delve].hitpoints} HP)</option>
            ))}
          </select>
        </label>
        <p style={{ fontSize: 12, textAlign: "center", margin: "6px 0" }}>{DELVE_NOTES[snapshot.delve]}</p>
        <p style={{ fontSize: 11, textAlign: "center", margin: "0 0 6px" }}>
          Wiki budget setup. Orbs are prayed on impact; the rock throw knocks your prayers off.
        </p>
        <RuneScapeButton type="button" onClick={() => region.requestStart()}>Start (Space)</RuneScapeButton>
      </RuneScapePanel>
    </Modal>
  );
}

function Bar({ value, max, colour, label }: { value: number; max: number; colour: string; label: string }) {
  const ratio = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 14 }}>{label}</div>
      <div style={{ background: "#111", border: "1px solid #5a5040", height: 10, width: 220 }}>
        <div style={{ background: colour, height: "100%", width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

export function DoomStatus({ region }: { region: DoomRegion }) {
  const s = useSyncExternalStore(region.subscribe, region.getSnapshot, region.getSnapshot);
  if (s.phase === "waiting") return null;
  const phaseLabel: Record<string, string> = {
    countdown: "Emerging...",
    normal: "Fighting",
    volatile: "Volatile earth!",
    shield: "SHIELDED: demonbane only",
    car: "BURROWED: dodge and keep attacking",
    dead: "Delve complete!",
  };
  return (
    <div style={{
      background: "rgba(20, 16, 10, 0.78)",
      border: "2px solid #5a5040",
      borderRadius: 4,
      color: "white",
      fontFamily: "OSRS",
      left: 8,
      padding: "6px 10px",
      pointerEvents: "none",
      position: "absolute",
      textShadow: "1px 1px 0 black",
      top: 40,
      zIndex: 3,
    }}>
      <div style={{ color: "#ffcf3f", fontSize: 20 }}>Delve {s.delve}: {phaseLabel[s.phase] ?? s.phase}</div>
      {s.phase === "shield" && <Bar value={s.shield} max={500} colour="#3fa9ff" label={`Shield ${Math.max(0, s.shield)} / 500`} />}
      {s.charge !== null && (
        <Bar
          value={s.chargeMax - s.charge}
          max={s.chargeMax}
          colour="#ffd400"
          label={s.meleeOnly ? "Beam charging: hit it with MELEE!" : s.phase === "shield" ? "Beam charging: demonbane to reset" : "Beam charging: attack to reset"}
        />
      )}
      {s.volatileTicks !== null && (
        <div style={{ color: "#c9a227", fontSize: 16, marginTop: 4 }}>Shockwave in {s.volatileTicks} ticks: break 2 volatile earth</div>
      )}
      {s.demonicCharge > 0 && <div style={{ color: "#ff6060", fontSize: 14, marginTop: 4 }}>Demonic charge: {s.demonicCharge}</div>}
    </div>
  );
}

export function DoomSidebar({ region }: { region: DoomRegion }) {
  const sdkSettings = useSyncExternalStore(Settings.subscribe, Settings.getSnapshot, Settings.getSnapshot);
  return (
    <>
      <p style={{ color: "#ffcf3f", margin: "4px 0" }}>Doom of Mokhaiotl (delves 5-8)</p>
      <RuneScapeButton type="button" onClick={() => (region.replay.isReplaying() ? region.replay.exitReplay() : Trainer.reset())}>
        Restart (Ctrl+R)
      </RuneScapeButton>
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
      <p style={{ fontSize: 11 }}>
        Larvae: ranged (green) need range, magic (blue) need magic, melee only in the shield phase.
        Darklight / Slayer&apos;s staff (e) / scorching bow are demonbane.
      </p>
      <RuneScapeButton type="button" onClick={() => window.location.assign("waves.html")}>Colosseum waves trainer</RuneScapeButton>
    </>
  );
}
