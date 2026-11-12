import React, { useEffect, useState, useSyncExternalStore } from "react";
import { ControlPanelController, FixedLayout, Settings, Trainer, Viewport } from "osrs-sdk";
import { Modal } from "osrs-sdk-react";

import { KING_HITPOINTS, LARVAE_THRESHOLD, MELEE_THRESHOLD, MULTI_LARVAE_THRESHOLD } from "./MaggotConfig";
import { MaggotRegion, type MaggotSnapshot } from "./MaggotRegion";

/*
 * Maggot King UI: a bile-and-bone theme of its own, with the fight HUD inside the game viewport
 * like a RuneLite overlay.
 */

const COLOURS = {
  bile: "#9ccf3a",
  sticky: "#e2c044",
  bone: "#e8dcc0",
  blood: "#d8432f",
  magic: "#5ab0ff",
  text: "#ece4d2",
  muted: "#9c9583",
};

const THEME_CSS = `
body.maggot-theme {
  background: radial-gradient(ellipse at 40% 30%, #1c2210 0%, #0d1008 50%, #050604 100%);
}
body.maggot-theme #disclaimer_panel { color: #5d604c; }
body.maggot-theme > div[style*="position: fixed"][style*="z-index: 10000"] { display: none; }
.mk-sidebar {
  background: linear-gradient(180deg, #171a0f 0%, #10120b 60%, #0b0c08 100%);
  border-left: 1px solid #3a3d22;
  box-shadow: inset 1px 0 0 #23261a, -8px 0 24px rgba(0,0,0,.45);
  box-sizing: border-box;
  color: ${COLOURS.text};
  font-family: 'OSRS', sans-serif;
  padding: 14px 14px 18px;
}
.mk-sidebar h1 {
  color: ${COLOURS.bile};
  font-size: 24px;
  font-weight: normal;
  letter-spacing: 1px;
  margin: 2px 0;
  text-shadow: 0 0 12px rgba(150,210,60,.3), 1px 1px 0 #000;
}
.mk-sub { color: ${COLOURS.muted}; font-size: 14px; margin-bottom: 12px; }
.mk-sidebar h2 {
  border-bottom: 1px solid #33361f;
  color: ${COLOURS.bone};
  font-size: 15px;
  font-weight: normal;
  letter-spacing: .5px;
  margin: 16px 0 8px;
  padding-bottom: 3px;
  text-transform: uppercase;
}
.mk-btn {
  background: linear-gradient(180deg, #2b2f1a 0%, #1c1f11 100%);
  border: 1px solid #484c2b;
  border-radius: 4px;
  box-shadow: inset 0 1px 0 rgba(220,230,160,.08), 0 1px 2px rgba(0,0,0,.6);
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
.mk-btn:hover { border-color: ${COLOURS.bile}; background: linear-gradient(180deg, #353a1f 0%, #222613 100%); }
.mk-btn:active { transform: translateY(1px); }
.mk-btn.primary {
  background: linear-gradient(180deg, #7aa22a 0%, #4a6614 100%);
  border-color: #a9d84a;
  color: #fbfff0;
  text-align: center;
}
.mk-btn.primary:hover { background: linear-gradient(180deg, #8ab532 0%, #557418 100%); }
.mk-btn kbd { color: ${COLOURS.muted}; float: right; font-family: inherit; font-size: 13px; }
.mk-btn.primary kbd { color: #e3f2c3; float: none; margin-left: 6px; }
.mk-guide { font-size: 13px; line-height: 1.35; margin: 0; padding: 0; list-style: none; }
.mk-guide li { margin: 0 0 6px; padding-left: 14px; position: relative; }
.mk-guide li::before {
  background: var(--dot, ${COLOURS.bile});
  border-radius: 50%;
  content: "";
  height: 7px;
  left: 0;
  position: absolute;
  top: 5px;
  width: 7px;
}
.mk-guide b { color: var(--dot, ${COLOURS.bile}); font-weight: normal; }
.mk-check { align-items: center; display: flex; font-size: 14px; gap: 6px; margin: 4px 0; }
.mk-check input { accent-color: ${COLOURS.bile}; }
.mk-stats { display: grid; font-size: 13px; gap: 2px 8px; grid-template-columns: 1fr auto; }
.mk-stats span:nth-child(even) { color: ${COLOURS.bone}; text-align: right; }
.mk-footer { color: #5d604c; font-size: 12px; margin-top: 14px; }
.mk-footer #gpu_warning { font-size: 12px; margin-top: 8px; }

.mk-start {
  background: linear-gradient(180deg, rgba(24,27,15,.97) 0%, rgba(11,12,7,.97) 100%);
  border: 1px solid #484c2b;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #000, 0 0 40px rgba(140,200,50,.14), 0 18px 40px rgba(0,0,0,.7);
  color: ${COLOURS.text};
  font-family: 'OSRS', sans-serif;
  padding: 18px 20px 16px;
  width: 360px;
}
.mk-start h1 {
  color: ${COLOURS.bile};
  font-size: 28px;
  font-weight: normal;
  letter-spacing: 1px;
  margin: 0;
  text-align: center;
  text-shadow: 0 0 14px rgba(150,210,60,.4), 1px 1px 0 #000;
}
.mk-start .mk-sub { margin: 2px 0 12px; text-align: center; }
.mk-start ul { font-size: 14px; margin: 0 0 12px; padding-left: 18px; }
.mk-start .mk-gear { color: ${COLOURS.muted}; font-size: 12px; margin: 0 0 12px; text-align: center; }

.mk-hud {
  background: rgba(10, 12, 7, .74);
  border: 1px solid rgba(72, 76, 43, .9);
  border-radius: 3px;
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
.mk-hud .row { display: flex; gap: 8px; justify-content: space-between; }
.mk-hud .pips { display: flex; gap: 2px; margin: 2px 0 1px; }
.mk-hud .pips i { background: #2a2a1c; border: 1px solid #000; display: block; height: 6px; width: 14px; }
.mk-hud .pips i.on { background: #ff8a2a; }
.mk-alert {
  animation: mk-pulse 1.1s ease-in-out infinite;
  font-family: 'OSRS', sans-serif;
  font-size: 20px;
  pointer-events: none;
  position: absolute;
  text-align: center;
  text-shadow: 0 0 8px rgba(0,0,0,.9), 1px 1px 0 #000, -1px -1px 0 #000;
  transform: translateX(-50%);
  white-space: nowrap;
  z-index: 3;
}
@keyframes mk-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
`;

function useMaggotSnapshot(region: MaggotRegion) {
  return useSyncExternalStore(region.subscribe, region.getSnapshot, region.getSnapshot);
}

/** Page chrome for maggot.html: title, background and theme styles. */
export function MaggotTheme() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Maggot King Trainer";
    document.body.classList.add("maggot-theme");
    return () => {
      document.title = previousTitle;
      document.body.classList.remove("maggot-theme");
    };
  }, []);
  return <style>{THEME_CSS}</style>;
}

export function MaggotStartModal({ region }: { region: MaggotRegion }) {
  const snapshot = useMaggotSnapshot(region);
  if (snapshot.phase !== "waiting") return null;
  return (
    <Modal blocking={false} open aria-label="Start fight">
      <div className="mk-start">
        <h1>The Maggot King</h1>
        <div className="mk-sub">1,500 hitpoints &middot; solo instance</div>
        <ul>
          <li>Pray range for green spit, magic for yellow</li>
          <li>Turn prayers <b style={{ color: COLOURS.blood, fontWeight: "normal" }}>off</b> for the screech</li>
          <li>Below 65%: dodge the slams, punish with the bludgeon</li>
          <li>Shoot larvae down with the crystal bow</li>
        </ul>
        <div className="mk-gear">Your setup: void mage + Twinflame staff (Fire Wave), bludgeon and crystal bow switches</div>
        <button type="button" className="mk-btn primary" onClick={() => region.requestStart()}>
          Enter the lair <kbd>(Space)</kbd>
        </button>
      </div>
    </Modal>
  );
}

/** The game viewport's on-page rectangle (fixed client or resizable). */
function useViewportRect() {
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  useEffect(() => {
    let timer = 0;
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
      timer = window.setTimeout(measure, 500);
    };
    measure();
    return () => window.clearTimeout(timer);
  }, []);
  return rect;
}

function phaseLabel(s: MaggotSnapshot) {
  if (s.phase === "waiting") return "Ready";
  if (s.phase === "countdown") return "Stirring...";
  if (s.phase === "dead") return "Dead!";
  if (s.screeching) return "SCREECH";
  if (s.enraged) return "Enraged: slams only";
  if (s.mode === "melee") return "Slams";
  return s.style === "range" ? "Ranged (green)" : "Magic (yellow)";
}

function alertFor(s: MaggotSnapshot): { text: string; colour: string } | null {
  if (s.phase !== "fight") return null;
  if (s.screeching && !s.enraged) return { text: "Prayers off! Dodge the carrion", colour: COLOURS.bone };
  if (s.larvaeFlying > 0) return { text: "Shoot the larva!", colour: COLOURS.bile };
  if (s.slamIncoming) return { text: "Slam! Step to the edge and punish", colour: COLOURS.blood };
  return null;
}

/** RuneLite-style overlay inside the viewport, plus a centred call-out for the current mechanic. */
export function MaggotStatus({ region }: { region: MaggotRegion }) {
  const s = useMaggotSnapshot(region);
  const rect = useViewportRect();
  if (s.phase === "waiting" || !rect) return null;
  const alert = alertFor(s);
  const seconds = Math.floor(s.ticks * 0.6);
  const styleColour = s.mode === "melee" ? COLOURS.blood : s.style === "range" ? COLOURS.bile : COLOURS.sticky;
  return (
    <>
      <div className="mk-hud" style={{ left: rect.x + 6, top: rect.y + 6, width: Math.min(150, rect.width * 0.25) }}>
        <div className="row">
          <span style={{ color: COLOURS.bile }}>Maggot King</span>
          <span style={{ color: COLOURS.muted }}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
        </div>
        <div style={{ color: s.screeching ? COLOURS.bone : styleColour }}>{phaseLabel(s)}</div>
        <div className="row" style={{ marginTop: 3 }}><span>Burn</span><span>{s.burnStacks}/5</span></div>
        <div className="pips">{[0, 1, 2, 3, 4].map((index) => <i key={index} className={index < s.burnStacks ? "on" : ""} />)}</div>
        {s.larvae > 0 && <div className="row" style={{ color: COLOURS.bile }}><span>Larvae</span><span>{s.larvae}</span></div>}
        {s.poison > 0 && <div className="row" style={{ color: "#5fbf3a" }}><span>Poison</span><span>{s.poison}</span></div>}
        {(s.punishes > 0 || s.punishesMissed > 0) && (
          <div className="row"><span>Punishes</span><span>{s.punishes}/{s.punishes + s.punishesMissed}</span></div>
        )}
      </div>
      {alert && (
        <div className="mk-alert" style={{ color: alert.colour, left: rect.x + rect.width / 2, top: rect.y + rect.height * 0.2 }}>
          {alert.text}
        </div>
      )}
    </>
  );
}

const GUIDE: { colour: string; title: string; text: string }[] = [
  { colour: COLOURS.bile, title: "Green spit", text: "ranged, up to 46: Protect from Range. Leaves poisonous bile." },
  { colour: COLOURS.sticky, title: "Yellow spit", text: "magic, up to 46: Protect from Magic. Sticky bile drains stats and delays your attack." },
  { colour: COLOURS.bone, title: "Screech", text: "after 4-8 attacks. Turn prayer OFF (15-25 a tick if on). Defence halves to 100." },
  { colour: COLOURS.blood, title: "Carrion", text: "shadows land next tick or two, up to 25; splatter up to 10. Clears bile." },
  { colour: COLOURS.bile, title: "Larvae", text: `from ${LARVAE_THRESHOLD} HP, one per screech (west first). Crystal bow kills them in the air. Landed ones eat carrion (+1) and leech you if you stand under them.` },
  { colour: COLOURS.blood, title: "Slams", text: `below ${MELEE_THRESHOLD} HP it walks to the wall and slams a 3x4 area (55, or 35 praying melee). Stand on its edge tile and attack as it slams.` },
  { colour: "#ff8a2a", title: "Fire spells", text: "each hit burns for 5 and strips 20 magic defence (5 stacks)." },
  { colour: COLOURS.magic, title: "Below 20%", text: `it stays at the wall and only slams; from ${MULTI_LARVAE_THRESHOLD} HP larvae come in groups.` },
];

export function MaggotSidebar({ region }: { region: MaggotRegion }) {
  const s = useMaggotSnapshot(region);
  const sdkSettings = useSyncExternalStore(Settings.subscribe, Settings.getSnapshot, Settings.getSnapshot);
  const replaying = region.replay.isReplaying();
  const hpPercent = Math.round((s.kingHp / KING_HITPOINTS) * 100);
  return (
    <aside id="right_panel" className="mk-sidebar" style={{
      display: sdkSettings.menuVisible ? "block" : "none",
      flex: "0 0 auto",
      height: "100%",
      overflowY: "auto",
      width: 240,
    }}>
      <h1>Maggot King</h1>
      <div className="mk-sub">{phaseLabel(s)} &middot; {s.kingHp} hp ({hpPercent}%)</div>

      <button type="button" className="mk-btn primary" onClick={() => (s.phase === "waiting" ? region.requestStart() : replaying ? region.replay.exitReplay() : Trainer.reset())}>
        {s.phase === "waiting" ? "Enter the lair" : replaying ? "Exit replay" : "Restart"} <kbd>{s.phase === "waiting" ? "(Space)" : "(Ctrl+R)"}</kbd>
      </button>
      <button type="button" className="mk-btn" onClick={() => region.replay.startReplay()}>Replay last 30s</button>

      <h2>This kill</h2>
      <div className="mk-stats">
        <span>Time</span><span>{Math.floor((s.ticks * 0.6) / 60)}:{String(Math.floor(s.ticks * 0.6) % 60).padStart(2, "0")}</span>
        <span>Burn stacks</span><span>{s.burnStacks}/5</span>
        <span>Melee punishes</span><span>{s.punishes}/{s.punishes + s.punishesMissed}</span>
      </div>

      <h2>Mechanics</h2>
      <ul className="mk-guide">
        {GUIDE.map((item) => (
          <li key={item.title} style={{ "--dot": item.colour } as React.CSSProperties}>
            <b>{item.title}:</b> {item.text}
          </li>
        ))}
      </ul>

      <h2>Options</h2>
      <label className="mk-check">
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
      <button type="button" className="mk-btn" onClick={() => ControlPanelController.controller.setActiveControl("SETTINGS")}>
        Keybinds &amp; settings
      </button>
      <button type="button" className="mk-btn" onClick={() => window.location.assign("doom.html")}>Doom trainer <kbd>&rarr;</kbd></button>
      <button type="button" className="mk-btn" onClick={() => window.location.assign("waves.html")}>Colosseum trainer <kbd>&rarr;</kbd></button>

      <div className="mk-footer">
        Not affiliated with Jagex. Game assets are property of Jagex.
        <div id="gpu_warning" />
      </div>
    </aside>
  );
}
