import { describe, expect, it } from 'vitest';
import {
  ANSWERING_STATUSES,
  BLOCK_REVIEW_STATUSES,
  BLOCK_STARTED_STATUSES,
  GRADED_STATUSES,
  GRADING_STATUSES,
  QUESTION_ON_AIR_STATUSES,
  REVEALING_STATUSES,
  isAnsweringStatus,
  isBlockReviewStatus,
  isBlockStartedStatus,
  isGradedStatus,
  isGradingStatus,
  isQuestionOnAirStatus,
  isRevealingStatus,
  type GameStatus,
} from '../game-state';

interface Membership {
  answering: boolean;
  questionOnAir: boolean;
  grading: boolean;
  graded: boolean;
  revealing: boolean;
  blockReview: boolean;
  blockStarted: boolean;
}

// Typed as a Record so adding a GameStatus fails to compile (and the
// coverage check below fails at runtime) until its memberships are decided.
const MEMBERSHIP: Record<GameStatus, Membership> = {
  lobby: m(),
  rules: m(),
  round_overview: m(),
  round_intro: m({ answering: true, blockStarted: true }),
  question_open: m({
    answering: true,
    questionOnAir: true,
    blockStarted: true,
  }),
  locking: m({ answering: true, questionOnAir: true, blockStarted: true }),
  break_intro: m({
    grading: true,
    graded: true,
    blockReview: true,
    blockStarted: true,
  }),
  break: m({
    grading: true,
    graded: true,
    blockReview: true,
    blockStarted: true,
  }),
  break_round_intro: m({
    grading: true,
    graded: true,
    blockReview: true,
    blockStarted: true,
  }),
  reveal_intro: m({
    graded: true,
    revealing: true,
    blockReview: true,
    blockStarted: true,
  }),
  reveal: m({
    graded: true,
    revealing: true,
    blockReview: true,
    blockStarted: true,
  }),
  ended: m({ graded: true, blockStarted: true }),
};

function m(overrides: Partial<Membership> = {}): Membership {
  return {
    answering: false,
    questionOnAir: false,
    grading: false,
    graded: false,
    revealing: false,
    blockReview: false,
    blockStarted: false,
    ...overrides,
  };
}

const GROUPS = [
  ['answering', ANSWERING_STATUSES, isAnsweringStatus],
  ['questionOnAir', QUESTION_ON_AIR_STATUSES, isQuestionOnAirStatus],
  ['grading', GRADING_STATUSES, isGradingStatus],
  ['graded', GRADED_STATUSES, isGradedStatus],
  ['revealing', REVEALING_STATUSES, isRevealingStatus],
  ['blockReview', BLOCK_REVIEW_STATUSES, isBlockReviewStatus],
  ['blockStarted', BLOCK_STARTED_STATUSES, isBlockStartedStatus],
] as const;

describe('game status groups', () => {
  const statuses = Object.keys(MEMBERSHIP) as GameStatus[];

  it('decides memberships for exactly the statuses the state machine has', () => {
    const everyStatus = new Set<GameStatus>(statuses);
    for (const [, set] of GROUPS) {
      for (const status of set) expect(everyStatus.has(status)).toBe(true);
    }
    expect(statuses).toHaveLength(12);
  });

  it.each(GROUPS)(
    '%s: set and predicate agree with the table for every status',
    (name, set, predicate) => {
      for (const status of statuses) {
        const expected = MEMBERSHIP[status][name];
        expect(set.has(status), `${name} set / ${status}`).toBe(expected);
        expect(predicate(status), `${name} predicate / ${status}`).toBe(
          expected,
        );
      }
    },
  );
});
