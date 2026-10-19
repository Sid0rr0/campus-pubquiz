/**
 * The coverage registry: everything a full `pnpm e2e` run must have visited.
 *
 * Nothing here is edited per journey. The cells are generated from the lists
 * below (the status table in DOCUMENTATION.md is the checklist), and a journey
 * records what it covers only by calling `snap(screen, status)` (see
 * snapshots.ts) or a move helper on a screen object (which call `recordMove`).
 * Adding a status or move means adding it to the lists here, once.
 */
import { test } from '@playwright/test';

/** Every status of the state machine in DOCUMENTATION.md ("Statuses"). */
export const STATUSES = [
  'lobby',
  'rules',
  'round_overview',
  'round_intro',
  'question_open',
  'locking',
  'break_intro',
  'break',
  'break_round_intro',
  'reveal_intro',
  'reveal',
  'ended',
] as const;
export type Status = (typeof STATUSES)[number];

/** The three screens a status is checked on. */
export const SCREENS = ['display', 'phone', 'control'] as const;
export type Screen = (typeof SCREENS)[number];

/** Moves and overlays of DOCUMENTATION.md that are not statuses. */
export const MOVES = [
  /** `PREVIOUS` from `break_intro` through break review. */
  'previous_break_review',
  /** `PREVIOUS` back across a block boundary into the earlier block's reveal. */
  'previous_across_block',
  /** `TOGGLE_LEADERBOARD`. */
  'leaderboard_toggle',
  /** The leaderboard's slot-by-slot rank reveal. */
  'leaderboard_reveal',
  /** `TOGGLE_JOIN_OVERLAY`. */
  'join_overlay',
  /** The 5-step `closest_guess` reveal. */
  'closest_guess_reveal',
  /** A showdown turn. */
  'showdown_turn',
  /** Auto-advance between statuses. */
  'auto_advance',
  /** A phase timer running out. */
  'phase_timer',
  /** `TOGGLE_MEDIA_PAUSE`. */
  'media_pause',
  /** `REPLAY_MEDIA`. */
  'media_replay',
  /** `TOGGLE_MEDIA_FULLSCREEN`. */
  'media_fullscreen',
  /** `END_QUIZ`. */
  'end_quiz',
] as const;
export type Move = (typeof MOVES)[number];

/** The id of a status × screen cell, such as `display:break_intro`. */
export function cellId(screen: Screen, status: Status): string {
  return `${screen}:${status}`;
}

export function moveId(move: Move): string {
  return `move:${move}`;
}

/** Every id a full run must visit. */
export const REQUIRED_IDS: readonly string[] = [
  ...SCREENS.flatMap((screen) =>
    STATUSES.map((status) => cellId(screen, status)),
  ),
  ...MOVES.map(moveId),
];

/**
 * A visit travels from the test's worker to the reporter as a test annotation
 * of this type (the reporter only counts passing tests).
 */
export const COVERAGE_ANNOTATION = 'coverage';

function recordVisit(id: string): void {
  test.info().annotations.push({ type: COVERAGE_ANNOTATION, description: id });
}

export function recordCell(screen: Screen, status: Status): void {
  recordVisit(cellId(screen, status));
}

/** Records that the running test performed `move`. Move helpers on the screen objects call this. */
export function recordMove(move: Move): void {
  recordVisit(moveId(move));
}
