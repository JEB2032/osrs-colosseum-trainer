"use strict";
import { Settings } from "./Settings";

/**
 * Geometry of the classic OSRS fixed-mode client. All values are in fixed-client
 * pixels (765x503) and are multiplied by `scale()` to get canvas pixels, the same
 * way RuneLite's Stretched Mode scales the fixed client to fit the window.
 */
export const FIXED_WIDTH = 765;
export const FIXED_HEIGHT = 503;

// The 3D scene only occupies the top-left of the fixed client.
export const FIXED_VIEWPORT = { x: 4, y: 4, width: 512, height: 334 };
export const FIXED_CHATBOX = { x: 0, y: 338, width: 519, height: 165 };

// Side panel: a row of 7 tabs above the panel and a row of 7 tabs below it.
export const FIXED_TABS_X = 522;
export const FIXED_TOP_TABS_Y = 168;
export const FIXED_BOTTOM_TABS_Y = 466;
export const FIXED_PANEL = { x: 553, y: 205, width: 190, height: 261 };

export class FixedLayout {
  static get enabled() {
    return Settings.fixedMode && !Settings.mobileCheck();
  }

  /** Canvas size for a playable area, letterboxed to the fixed client's aspect ratio. */
  static fit(width: number, height: number) {
    const scale = Math.min(width / FIXED_WIDTH, height / FIXED_HEIGHT);
    return {
      width: Math.max(1, Math.round(FIXED_WIDTH * scale)),
      height: Math.max(1, Math.round(FIXED_HEIGHT * scale)),
    };
  }

  /** Canvas pixels per fixed-client pixel. */
  static scale(canvasWidth: number) {
    return canvasWidth / FIXED_WIDTH;
  }

  static viewportRect(canvasWidth: number) {
    const k = FixedLayout.scale(canvasWidth);
    return {
      x: Math.round(FIXED_VIEWPORT.x * k),
      y: Math.round(FIXED_VIEWPORT.y * k),
      width: Math.round(FIXED_VIEWPORT.width * k),
      height: Math.round(FIXED_VIEWPORT.height * k),
    };
  }

  static chatMessages: { text: string; color: string }[] = [];

  /**
   * Infoboxes (like RuneLite's Visual Metronome) drawn as 32x32 boxes. Each returns its text,
   * or null to hide it.
   */
  static infoboxes: (() => { text: string; active?: boolean } | null)[] = [];

  /** Draw infoboxes right-aligned at the given position in fixed-client pixels. */
  static drawInfoboxes(context: CanvasRenderingContext2D, k: number, rightX: number, topY: number) {
    const boxes = FixedLayout.infoboxes.map((box) => box()).filter((box) => box !== null);
    boxes.forEach((box, index) => {
      const size = 32 * k;
      const x = (rightX - 34 * (index + 1)) * k;
      const y = topY * k;
      context.save();
      context.fillStyle = "rgba(70, 61, 50, 0.85)";
      context.fillRect(x, y, size, size);
      context.strokeStyle = "#1e1912";
      context.lineWidth = Math.max(1, k);
      context.strokeRect(x, y, size, size);
      // Tick indicator square, as in the RuneLite Visual Metronome.
      context.fillStyle = box.active ? "#ffffff" : "#000000";
      context.fillRect(x + 12 * k, y + 8 * k, 8 * k, 8 * k);
      context.font = `${Math.round(16 * k)}px OSRS`;
      context.textAlign = "center";
      context.fillStyle = "#000000";
      context.fillText(box.text, x + 17 * k, y + 29 * k);
      context.fillStyle = "#ffffff";
      context.fillText(box.text, x + 16 * k, y + 28 * k);
      context.restore();
    });
  }

  /** Append a game message to the fixed-mode chatbox. */
  static addChatMessage(text: string, color = "#000000") {
    FixedLayout.chatMessages.push({ text, color });
    if (FixedLayout.chatMessages.length > 8) FixedLayout.chatMessages.shift();
  }

  /** Draw the stone frame, side panel backing and chatbox around the 3D viewport. */
  static drawFrame(context: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) {
    const k = FixedLayout.scale(canvasWidth);
    const view = FixedLayout.viewportRect(canvasWidth);
    context.save();

    // Stone frame: everything that is not the 3D viewport.
    context.fillStyle = "#3e3529";
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    context.fillStyle = "#2b241b";
    context.fillRect(view.x - 2 * k, view.y - 2 * k, view.width + 4 * k, view.height + 4 * k);

    // Side panel backing between the two tab rows.
    context.fillStyle = "#4b4136";
    context.fillRect(
      (FIXED_TABS_X - 2) * k,
      (FIXED_TOP_TABS_Y + 36) * k,
      (7 * 33 + 4) * k,
      (FIXED_BOTTOM_TABS_Y - FIXED_TOP_TABS_Y - 36) * k,
    );

    // Chatbox parchment.
    const chat = FIXED_CHATBOX;
    context.fillStyle = "#2b241b";
    context.fillRect(chat.x * k, chat.y * k, chat.width * k, chat.height * k);
    context.fillStyle = "#cfc08d";
    context.fillRect((chat.x + 7) * k, (chat.y + 7) * k, (chat.width - 14) * k, (chat.height - 37) * k);
    context.fillStyle = "#94866d";
    context.fillRect((chat.x + 7) * k, (chat.y + chat.height - 47) * k, (chat.width - 14) * k, 1 * k);

    // Chat filter buttons strip.
    context.fillStyle = "#1e1912";
    context.fillRect(chat.x * k, (chat.y + chat.height - 23) * k, chat.width * k, 23 * k);
    context.font = `${Math.round(12 * k)}px OSRS`;
    context.textAlign = "center";
    ["All", "Game", "Public", "Private", "Channel", "Clan", "Trade"].forEach((label, index) => {
      const x = (chat.x + 28 + index * 62) * k;
      context.fillStyle = "#ffffff";
      context.fillText(label, x, (chat.y + chat.height - 8) * k);
    });

    // Messages, newest at the bottom.
    context.textAlign = "left";
    context.font = `${Math.round(16 * k)}px OSRS`;
    const lineHeight = 14 * k;
    const bottom = (chat.y + chat.height - 52) * k;
    FixedLayout.chatMessages
      .slice()
      .reverse()
      .forEach((message, index) => {
        context.fillStyle = message.color;
        context.fillText(message.text, (chat.x + 12) * k, bottom - index * lineHeight);
      });
    context.fillStyle = "#000000";
    context.fillText("Player: *", (chat.x + 12) * k, (chat.y + chat.height - 30) * k);

    context.restore();
  }
}
