import type { GameStatus } from './game-state-types';

type StatusGroup = ReadonlySet<GameStatus>;

/** Teams can (re-)answer: a question is open or locking, or a round intro sits over questions already open. */
export const ANSWERING_STATUSES: StatusGroup = new Set<GameStatus>([
  'question_open',
  'locking',
  'round_intro',
]);

/** A question is actually on air — shown on /display and live on the phones. */
export const QUESTION_ON_AIR_STATUSES: StatusGroup = new Set<GameStatus>([
  'question_open',
  'locking',
]);

/** The block is in its break (the quiz master reviews and finishes grading here; grading itself can start earlier). */
export const BREAK_STATUSES: StatusGroup = new Set<GameStatus>([
  'break_intro',
  'break',
  'break_round_intro',
]);

/** A block's grading is complete or under review — ungradedQuestionIds can be trusted from here on. */
export const GRADED_STATUSES: StatusGroup = new Set<GameStatus>([
  ...BREAK_STATUSES,
  'reveal_intro',
  'reveal',
  'ended',
]);

/** Answers are being revealed. */
export const REVEALING_STATUSES: StatusGroup = new Set<GameStatus>([
  'answers_intro',
  'answers',
  'reveal_intro',
  'reveal',
]);

/** Every status where a block's questions exist for the session. */
export const BLOCK_STARTED_STATUSES: StatusGroup = new Set<GameStatus>([
  ...ANSWERING_STATUSES,
  ...GRADED_STATUSES,
  ...REVEALING_STATUSES,
]);

export function isAnsweringStatus(status: GameStatus): boolean {
  return ANSWERING_STATUSES.has(status);
}

export function isQuestionOnAirStatus(status: GameStatus): boolean {
  return QUESTION_ON_AIR_STATUSES.has(status);
}

export type BreakStatus = 'break_intro' | 'break' | 'break_round_intro';
export type RevealingStatus =
  | 'answers_intro'
  | 'answers'
  | 'reveal_intro'
  | 'reveal';

export function isBreakStatus(status: GameStatus): status is BreakStatus {
  return BREAK_STATUSES.has(status);
}

/** Whether a move from `from` to `to` leaves the break for good: into the reveal, or on past the block with the Early answer reveal. Only the Advance press needs grading complete for it. */
export function isBreakExit(from: GameStatus, to: GameStatus): boolean {
  return (from === 'break_intro' || from === 'break') && !isBreakStatus(to);
}

/** A question's answer is on air: a reveal or an Early answer reveal question (not a title card). */
export function isRevealQuestionStatus(
  status: GameStatus,
): status is 'answers' | 'reveal' {
  return status === 'answers' || status === 'reveal';
}

/** The Early answer reveal is airing, before the break: its title card or one of its answers. */
export function isEarlyAnswersStatus(
  status: GameStatus,
): status is 'answers_intro' | 'answers' {
  return status === 'answers_intro' || status === 'answers';
}

export function isGradedStatus(status: GameStatus): boolean {
  return GRADED_STATUSES.has(status);
}

export function isRevealingStatus(
  status: GameStatus,
): status is RevealingStatus {
  return REVEALING_STATUSES.has(status);
}

export function isBlockStartedStatus(status: GameStatus): boolean {
  return BLOCK_STARTED_STATUSES.has(status);
}

/**
 * Whether the join overlay may be toggled: after the quiz has started and
 * before it has ended. The lobby already shows the QR code, and nothing is
 * left to join once the quiz is over. The single source for that rule.
 */
export function isJoinOverlayAllowedStatus(status: GameStatus): boolean {
  return status !== 'lobby' && status !== 'ended';
}
