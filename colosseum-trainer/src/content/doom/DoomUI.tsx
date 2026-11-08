import React, { useEffect, useState, useSyncExternalStore } from "react";
import { ControlPanelController, FixedLayout, Settings, Trainer, Viewport } from "osrs-sdk";
import { Modal } from "osrs-sdk-react";

import { DelveLevel, DELVES } from "./DoomConfig";
import { DoomRegion, type DoomSnapshot } from "./DoomRegion";

/*
 * Doom of Mokhaiotl UI: its own ember-and-basalt theme rather than the Colosseum's stone panels,
 * with the fight HUD drawn inside the game viewport like a RuneLite overlay.
 */

const DELVE_LEVELS: DelveLevel[] = [5, 6, 7, 8];

const DELVE_NOTES: Record<DelveLevel, string[]> = {
  5: ["Burrow phase arrives: 2 zooms, trample 10", "3 shockwaves after volatile earth", "5-tick attacks"],
  6: ["Car slams: hide behind rock cover", "3 zooms, 99 beam", "Rock throw orbs land faster"],
  7: ["4-tick attacks", "4 shockwaves", "Faster rock projectiles"],
  8: ["Double rock throws", "Giant larvae (heal x3)", "5 shockwaves, fast car"],
};

const PHASE_LABELS: Record<DoomSnapshot["phase"], string> = {
  waiting: "Ready",
  countdown: "Emerging",
  normal: "Fighting",
  volatile: "Volatile earth",
  shield: "Shielded",
  car: "Burrowed",
  dead: "Delve complete",
};

const COLOURS = {
  ember: "#ff7a1f",
  gold: "#f6c25b",
  acid: "#a6dc4a",
  magic: "#5ab0ff",
  range: "#62d867",
  melee: "#ff5040",
  text: "#f1e6d6",
  muted: "#a8988a",
};

const THEME_CSS = `
body.doom-theme {
  background: radial-gradient(ellipse at 40% 30%, #2a0f08 0%, #120705 45%, #060303 100%);
}
body.doom-theme #disclaimer_panel { color: #6d5a4d; }
/* stats.js frame meter */
body.doom-theme > div[style*="position: fixed"][style*="z-index: 10000"] { display: none; }
.doom-sidebar {
  background: linear-gradient(180deg, #1b0f0b 0%, #120a08 60%, #0d0706 100%);
  border-left: 1px solid #4a2416;
  box-shadow: inset 1px 0 0 #2a140c, -8px 0 24px rgba(0,0,0,.45);
  box-sizing: border-box;
  color: ${COLOURS.text};
  font-family: 'OSRS', sans-serif;
  padding: 14px 14px 18px;
}
.doom-sidebar h1 {
  color: ${COLOURS.ember};
  font-size: 22px;
  font-weight: normal;
  letter-spacing: 1px;
  line-height: 1.05;
  margin: 2px 0 2px;
  text-shadow: 0 0 12px rgba(255,110,30,.35), 1px 1px 0 #000;
}
.doom-sidebar .doom-sub { color: ${COLOURS.muted}; font-size: 14px; margin-bottom: 12px; }
.doom-sidebar h2 {
  border-bottom: 1px solid #3b1d12;
  color: ${COLOURS.gold};
  font-size: 15px;
  font-weight: normal;
  letter-spacing: .5px;
  margin: 16px 0 8px;
  padding-bottom: 3px;
  text-transform: uppercase;
}
.doom-btn {
  background: linear-gradient(180deg, #3a1d12 0%, #26130c 100%);
  border: 1px solid #5a2b18;
  border-radius: 4px;
  box-shadow: inset 0 1px 0 rgba(255,160,90,.12), 0 1px 2px rgba(0,0,0,.6);
  color: ${COLOURS.text};
  cursor: pointer;
  display: block;
  font-family: 'OSRS', sans-serif;
  font-size: 16px;
  margin: 0 0 6px;
  padding: 7px 10px;
  text-align: left;
  text-shadow: 1px 1px 0 #000;
  transition: border-color .12s, background .12s, transform .06s;
  width: 100%;
}
.doom-btn:hover { background: linear-gradient(180deg, #4a2414 0%, #2f170d 100%); border-color: ${COLOURS.ember}; }
.doom-btn:active { transform: translateY(1px); }
.doom-btn.primary {
  background: linear-gradient(180deg, #d9581a 0%, #9a3510 100%);
  border-color: #ff8a3d;
  color: #fff7ec;
  text-align: center;
}
.doom-btn.primary:hover { background: linear-gradient(180deg, #ec6a24 0%, #ad3d13 100%); }
.doom-btn kbd {
  color: ${COLOURS.muted};
  float: right;
  font-family: inherit;
  font-size: 13px;
}
.doom-delves { display: grid; gap: 6px; grid-template-columns: repeat(4, 1fr); }
.doom-delve {
  background: #1d100b;
  border: 1px solid #452215;
  border-radius: 4px;
  color: ${COLOURS.muted};
  cursor: pointer;
  font-family: 'OSRS', sans-serif;
  font-size: 18px;
  padding: 6px 0 4px;
  text-align: center;
}
.doom-delve small { display: block; font-size: 11px; }
.doom-delve:hover { border-color: ${COLOURS.ember}; color: ${COLOURS.text}; }
.doom-delve.active {
  background: linear-gradient(180deg, #5b2410 0%, #2f140b 100%);
  border-color: ${COLOURS.ember};
  box-shadow: 0 0 10px rgba(255,110,30,.3);
  color: #fff;
}
.doom-guide { font-size: 13px; line-height: 1.35; margin: 0; padding: 0; list-style: none; }
.doom-guide li { margin: 0 0 6px; padding-left: 14px; position: relative; color: ${COLOURS.text}; }
.doom-guide li::before {
  background: var(--dot, ${COLOURS.ember});
  border-radius: 50%;
  content: "";
  height: 7px;
  left: 0;
  position: absolute;
  top: 5px;
  width: 7px;
}
.doom-guide b { color: var(--dot, ${COLOURS.ember}); font-weight: normal; }
.doom-check { align-items: center; color: ${COLOURS.text}; display: flex; font-size: 14px; gap: 6px; margin: 4px 0; }
.doom-check input { accent-color: ${COLOURS.ember}; }
.doom-footer { color: #6d5a4d; font-size: 12px; margin-top: 14px; }
.doom-footer #gpu_warning { font-size: 12px; margin-top: 8px; }

.doom-start {
  background: linear-gradient(180deg, rgba(30,14,9,.97) 0%, rgba(14,7,5,.97) 100%);
  border: 1px solid #5a2b18;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #000, 0 0 40px rgba(255,90,20,.18), 0 18px 40px rgba(0,0,0,.7);
  color: ${COLOURS.text};
  font-family: 'OSRS', sans-serif;
  padding: 18px 20px 16px;
  width: 360px;
}
.doom-start h1 {
  color: ${COLOURS.ember};
  font-size: 26px;
  font-weight: normal;
  letter-spacing: 1px;
  margin: 0;
  text-align: center;
  text-shadow: 0 0 14px rgba(255,110,30,.45), 1px 1px 0 #000;
}
.doom-start .doom-sub { color: ${COLOURS.muted}; font-size: 14px; margin: 2px 0 14px; text-align: center; }
.doom-start .doom-delves { margin-bottom: 10px; }
.doom-start ul { color: ${COLOURS.text}; font-size: 14px; margin: 0 0 12px; min-height: 58px; padding-left: 18px; }
.doom-start .doom-gear { color: ${COLOURS.muted}; font-size: 12px; margin: 0 0 12px; text-align: center; }

.doom-hud {
  background: rgba(14, 8, 6, .72);
  border: 1px solid rgba(90, 43, 24, .9);
  border-radius: 3px;
  box-shadow: 0 1px 0 #000;
  color: ${COLOURS.text};
  font-family: 'OSRS', sans-serif;
  font-size: 14px;
  line-height: 1.15;
  padding: 5px 7px 6px;
  pointer-events: none;
  position: absolute;
  text-shadow: 1px 1px 0 #000;
  z-index: 3;
}
.doom-hud .row { display: flex; justify-content: space-between; gap: 8px; }
.doom-hud .bar { background: #0a0504; border: 1px solid #000; height: 6px; margin: 2px 0 4px; overflow: hidden; }
.doom-hud .bar > div { height: 100%; transition: width .3s linear; }
.doom-alert {
  color: #fff;
  font-family: 'OSRS', sans-serif;
  font-size: 20px;
  pointer-events: none;
  position: absolute;
  text-align: center;
  text-shadow: 0 0 8px rgba(0,0,0,.9), 1px 1px 0 #000, -1px -1px 0 #000;
  transform: translateX(-50%);
  white-space: nowrap;
  z-index: 3;
  animation: doom-pulse 1.2s ease-in-out infinite;
}
@keyframes doom-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
`;

function useDoomSnapshot(region: DoomRegion) {
  return useSyncExternalStore(region.subscribe, region.getSnapshot, region.getSnapshot);
}

/** Page chrome for doom.html: title, background and theme styles. */
export function DoomTheme() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Doom of Mokhaiotl Trainer";
    document.body.classList.add("doom-theme");
    return () => {
      document.title = previousTitle;
      document.body.classList.remove("doom-theme");
    };
  }, []);
  return <style>{THEME_CSS}</style>;
}

/** Restart into another delve (the arena region differs from delve 6). */
function switchDelve(region: DoomRegion, delve: DelveLevel) {
  if (region.replay.isReplaying()) region.replay.exitReplay();
  if (region.getSnapshot().phase !== "waiting") Trainer.reset();
  region.setSelectedDelve(delve);
  Trainer.reset();
}

function DelvePicker({ region, delve }: { region: DoomRegion; delve: DelveLevel }) {
  return (
    <div className="doom-delves" role="radiogroup" aria-label="Delve level">
      {DELVE_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          role="radio"
          aria-checked={level === delve}
          className={`doom-delve${level === delve ? " active" : ""}`}
          onClick={() => switchDelve(region, level)}
        >
          {level}
          <small>{DELVES[level].hitpoints} hp</small>
        </button>
      ))}
    </div>
  );
}

export function DoomStartModal({ region }: { region: DoomRegion }) {
  const snapshot = useDoomSnapshot(region);
  if (snapshot.phase !== "waiting") return null;
  return (
    <Modal blocking={false} open aria-label="Start delve">
      <div className="doom-start">
        <h1>The Doom of Mokhaiotl</h1>
        <div className="doom-sub">Choose your delve</div>
        <DelvePicker region={region} delve={snapshot.delve} />
        <ul>
          {DELVE_NOTES[snapshot.delve].map((note) => <li key={note}>{note}</li>)}
        </ul>
        <div className="doom-gear">Wiki budget setup: scorching bow, elite void, Darklight, Slayer&apos;s staff (e)</div>
        <button type="button" className="doom-btn primary" onClick={() => region.requestStart()}>
          Descend <kbd style={{ float: "none", marginLeft: 6 }}>(Space)</kbd>
        </button>
      </div>
    </Modal>
  );
}

/** The game viewport's on-page rectangle (fixed client or resizable). */
function useViewportRect() {
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      const canvas = document.getElementById("world");
      if (canvas) {
        const bounds = canvas.getBoundingClientRect();
        const parent = canvas.offsetParent?.getBoundingClientRect() ?? { x: 0, y: 0 };
        let next = { x: bounds.x - parent.x, y: bounds.y - parent.y, width: bounds.width, height: bounds.height };
        if (FixedLayout.enabled) {
          const view = FixedLayout.viewportRect(bounds.width);
          next = { x: next.x + view.x, y: next.y + view.y, width: view.width, height: view.height };
        }
        setRect((previous) => (previous && previous.x === next.x && previous.y === next.y
          && previous.width === next.width && previous.height === next.height ? previous : next));
      }
      frame = window.setTimeout(measure, 500);
    };
    measure();
    return () => window.clearTimeout(frame);
  }, []);
  return rect;
}

function HudBar({ value, max, colour }: { value: number; max: number; colour: string }) {
  const ratio = Math.max(0, Math.min(1, value / max));
  return <div className="bar"><div style={{ background: colour, width: `${ratio * 100}%` }} /></div>;
}

function alertFor(s: DoomSnapshot): { text: string; colour: string } | null {
  if (s.meleeOnly) return { text: "Melee it to cancel the beam!", colour: COLOURS.melee };
  if (s.slamIncoming) return { text: "Car slam: get behind a rock!", colour: COLOURS.gold };
  if (s.volatileTicks !== null) return { text: "Break two volatile earth!", colour: COLOURS.gold };
  if (s.phase === "shield") return { text: "Demonbane the shield", colour: COLOURS.magic };
  return null;
}

/** RuneLite-style overlay inside the viewport, plus a centred call-out for the current mechanic. */
export function DoomStatus({ region }: { region: DoomRegion }) {
  const s = useDoomSnapshot(region);
  const rect = useViewportRect();
  if (s.phase === "waiting" || !rect) return null;
  const alert = alertFor(s);
  const seconds = Math.floor((s.ticks * 0.6));
  return (
    <>
      <div className="doom-hud" style={{ left: rect.x + 6, top: rect.y + 6, width: Math.min(150, rect.width * 0.25) }}>
        <div className="row">
          <span style={{ color: COLOURS.ember }}>Delve {s.delve}</span>
          <span style={{ color: COLOURS.muted }}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
        </div>
        <div style={{ color: s.phase === "dead" ? COLOURS.acid : COLOURS.text }}>{PHASE_LABELS[s.phase]}</div>
        {s.phase === "shield" && (
          <>
            <div className="row" style={{ marginTop: 3 }}><span>Shield</span><span>{Math.max(0, s.shield)}</span></div>
            <HudBar value={s.shield} max={500} colour={COLOURS.magic} />
          </>
        )}
        {s.charge !== null && (
          <>
            <div className="row" style={{ marginTop: 3 }}><span>Beam</span><span>{s.charge}t</span></div>
            <HudBar value={s.chargeMax - s.charge} max={s.chargeMax} colour={COLOURS.gold} />
          </>
        )}
        {s.volatileTicks !== null && (
          <div className="row" style={{ color: COLOURS.gold }}><span>Shockwave</span><span>{s.volatileTicks}t</span></div>
        )}
        {s.larvae > 0 && <div className="row" style={{ color: COLOURS.acid }}><span>Larvae</span><span>{s.larvae}</span></div>}
        {s.demonicCharge > 0 && (
          <div className="row" style={{ color: COLOURS.melee }}><span>Demonic charge</span><span>{s.demonicCharge}</span></div>
        )}
      </div>
      {alert && (
        <div className="doom-alert" style={{ color: alert.colour, left: rect.x + rect.width / 2, top: rect.y + rect.height * 0.2 }}>
          {alert.text}
        </div>
      )}
    </>
  );
}

const GUIDE: { colour: string; title: string; text: string }[] = [
  { colour: COLOURS.magic, title: "Orbs", text: "blue magic, green range, red melee. Pray as they land." },
  { colour: COLOURS.gold, title: "Rock throw", text: "move off the shadows; prayers drop, re-pray for the rock orbs." },
  { colour: COLOURS.melee, title: "Purple charge", text: "it protects from range + magic. Melee it or eat a beam." },
  { colour: COLOURS.magic, title: "Shield", text: "only demonbane hurts it. Kill larvae with their colour." },
  { colour: COLOURS.ember, title: "Burrowed", text: "step off its path; from delve 6 hide behind rocks for the slam." },
  { colour: COLOURS.gold, title: "Volatile earth", text: "break two, stand in the earthen shield for the shockwaves." },
  { colour: COLOURS.acid, title: "Acid blood", text: "never stand in it (venom + up to 7)." },
];

export function DoomSidebar({ region }: { region: DoomRegion }) {
  const s = useDoomSnapshot(region);
  const sdkSettings = useSyncExternalStore(Settings.subscribe, Settings.getSnapshot, Settings.getSnapshot);
  const replaying = region.replay.isReplaying();
  return (
    <aside id="right_panel" className="doom-sidebar" style={{
      display: sdkSettings.menuVisible ? "block" : "none",
      flex: "0 0 auto",
      height: "100%",
      overflowY: "auto",
      width: 240,
    }}>
      <h1>Doom of Mokhaiotl</h1>
      <div className="doom-sub">Delve {s.delve} &middot; {PHASE_LABELS[s.phase]}</div>

      <button type="button" className="doom-btn primary" onClick={() => (s.phase === "waiting" ? region.requestStart() : replaying ? region.replay.exitReplay() : Trainer.reset())}>
        {s.phase === "waiting" ? "Descend" : replaying ? "Exit replay" : "Restart"} <kbd style={{ float: "none", marginLeft: 6 }}>{s.phase === "waiting" ? "(Space)" : "(Ctrl+R)"}</kbd>
      </button>
      <button type="button" className="doom-btn" onClick={() => region.replay.startReplay()}>
        Replay last 30s
      </button>

      <h2>Delve</h2>
      <DelvePicker region={region} delve={s.delve} />

      <h2>Mechanics</h2>
      <ul className="doom-guide">
        {GUIDE.map((item) => (
          <li key={item.title} style={{ "--dot": item.colour } as React.CSSProperties}>
            <b>{item.title}:</b> {item.text}
          </li>
        ))}
      </ul>

      <h2>Options</h2>
      <label className="doom-check">
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
      <button type="button" className="doom-btn" onClick={() => ControlPanelController.controller.setActiveControl("SETTINGS")}>
        Keybinds &amp; settings
      </button>
      <button type="button" className="doom-btn" onClick={() => window.location.assign("waves.html")}>
        Colosseum trainer <kbd>&rarr;</kbd>
      </button>

      <div className="doom-footer">
        Not affiliated with Jagex. Game assets are property of Jagex.
        <div id="gpu_warning" />
      </div>
    </aside>
  );
}
