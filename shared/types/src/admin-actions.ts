import type { GameAction } from './game-state';

export interface AdminActionPayload {
  action: GameAction;
}

/** Admin-set/clear the display's break-end-time line — null clears it back to unset. */
export interface SetBreakEndTimePayload {
  breakEndsAt: number | null;
}

/** Admin-set text-size multiplier for /display (every screen except the header) — see DISPLAY_TEXT_SCALE_STEPS. */
export interface SetDisplayTextScalePayload {
  displayTextScale: number;
}
