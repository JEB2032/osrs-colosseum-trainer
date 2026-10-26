"use strict";
import { Trainer } from "./Trainer";
import { ControlPanelController } from "./ControlPanelController";
import { MapController } from "./MapController";
import { AttackStylesController } from "./AttackStylesController";
import type { EquipmentTypes } from "./Equipment";
import { ReplayAction, ReplayLog } from "./Replay";

/** Applies recorded inputs. Kept apart from ReplayLog, which the input code imports. */
export class ReplayPlayback {
  /** Re-apply a recorded input against the current (re-simulated) world. */
  static apply(action: ReplayAction) {
    const player = Trainer.player;
    if (!player) return;
    switch (action.kind) {
      case "walk":
        Trainer.clickController.playerWalkClick(action.x, action.y, action.invertRun === true);
        break;
      case "attackMob": {
        const region = player.region;
        const mob = [...region.mobs, ...region.newMobs][action.mob];
        if (mob) Trainer.clickController.playerAttackClick(mob);
        break;
      }
      case "interrupt":
        player.interruptCombat();
        break;
      case "unequip":
        ControlPanelController.controls.EQUIPMENT.equipmentInteractions[0](action.slot as EquipmentTypes);
        break;
      case "inventoryClick":
        player.inventory[action.slot]?.inventoryLeftClick(player);
        break;
      case "swap":
        player.swapItemPositions(action.a, action.b);
        break;
      case "prayer": {
        const prayer = player.prayerController.prayers[action.index];
        if (prayer && player.currentStats.prayer > 0 && prayer.toggleClient(player)) {
          prayer.toggleServer(player);
          const controls = ControlPanelController.controls.PRAYER;
          if (controls.hasQuickPrayersActivated && player.prayerController.activePrayers().length === 0) {
            controls.hasQuickPrayersActivated = false;
          }
        }
        break;
      }
      case "quickPrayers":
        MapController.controller.toggleQuickprayers(false);
        break;
      case "run":
        player.running = !player.running;
        break;
      case "spec":
        MapController.controller.toggleSpecialAttack(false);
        break;
      case "attackStyle": {
        const weapon = player.equipment.weapon;
        const style = weapon?.attackStyles()[action.index];
        if (weapon && style) AttackStylesController.controller.setWeaponAttackStyle(weapon, style);
        break;
      }
      case "autoRetaliate":
        player.autoRetaliate = !player.autoRetaliate;
        break;
      case "custom":
        ReplayLog.customHandlers[action.name]?.(action.data);
        break;
    }
  }
}
