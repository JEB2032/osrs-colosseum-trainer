import { Settings } from "./Settings";
import { ReplayAction, ReplayLog } from "./Replay";

const MAX_QUEUED_ACTIONS = 8;

/**
 * Controller to manage delayed inputs (due to input lag and/or tick timers)
 */
export class InputController {
  inputDelay?: ReturnType<typeof setTimeout> = null;

  clientActions: (() => void)[] = [];
  queuedActions: { fn: () => void; describe?: () => ReplayAction | null }[] = [];

  /** Called at the start of every world tick, before queued inputs are applied (used by replays). */
  beforeTick: ((tick: number) => void) | null = null;

  static controller = new InputController();

  /**
   * Queue an input to be sampled by the next 20 ms client tick.
   *
   * Prayer controls use this to keep browser event timing separate from both
   * the client-side lit state and the server-side active state.
   */
  queueClientAction(fn: () => void) {
    this.clientActions.push(fn);
  }

  onClientTick() {
    const actions = this.clientActions;
    this.clientActions = [];
    actions.forEach((action) => action());
  }

  /**
   * Queue an input for the next world tick. `describe` is evaluated when the input is applied and
   * returns a serialisable description of it, so it can be recorded for replays.
   */
  queueAction(fn: () => void, describe?: () => ReplayAction | null) {
    /*if (this.inputDelay) {
      clearTimeout(this.inputDelay);
    }*/
    if (this.queuedActions.length >= MAX_QUEUED_ACTIONS) {
      return;
    }
    this.inputDelay = setTimeout(() => {
      this.queuedActions.push({ fn, describe });
    }, Settings.inputDelay);
  }

  onWorldTick(tick = 0) {
    this.beforeTick?.(tick);
    const actions = this.flushQueuedActions();
    actions.forEach(({ fn, describe }) => {
      ReplayLog.recordQueued(describe?.() ?? null);
      fn();
    });
  }

  private flushQueuedActions() {
    const actions = this.queuedActions;
    this.queuedActions = [];
    return actions;
  }
}
