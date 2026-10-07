import type { GameAction } from './game-state';

export interface AdminActionPayload {
  action: GameAction;
}

/** Admin-set/clear the display's break-end-time line — null clears it back to unset. */
export interface SetBreakEndTimePayload {
  breakEndsAt: number | null;
}

/** Discrete steps the admin can pick between for /display's text size — 1 is the original, unscaled size. */
export const DISPLAY_TEXT_SCALE_STEPS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export const DEFAULT_DISPLAY_TEXT_SCALE: (typeof DISPLAY_TEXT_SCALE_STEPS)[number] = 1;

/** Admin-set text-size multiplier for /display (every screen except the header) — see DISPLAY_TEXT_SCALE_STEPS. */
export interface SetDisplayTextScalePayload {
  displayTextScale: number;
}
