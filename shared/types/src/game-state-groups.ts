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
  'reveal_intro',
  'reveal',
]);

/** Every status where a block's questions exist for the session. */
export const BLOCK_STARTED_STATUSES: StatusGroup = new Set<GameStatus>([
  ...ANSWERING_STATUSES,
  ...GRADED_STATUSES,
]);

export function isAnsweringStatus(status: GameStatus): boolean {
  return ANSWERING_STATUSES.has(status);
}

export function isQuestionOnAirStatus(status: GameStatus): boolean {
  return QUESTION_ON_AIR_STATUSES.has(status);
}

export function isBreakStatus(status: GameStatus): boolean {
  return BREAK_STATUSES.has(status);
}

export function isGradedStatus(status: GameStatus): boolean {
  return GRADED_STATUSES.has(status);
}

export function isRevealingStatus(status: GameStatus): boolean {
  return REVEALING_STATUSES.has(status);
}

export function isBlockStartedStatus(status: GameStatus): boolean {
  return BLOCK_STARTED_STATUSES.has(status);
}
