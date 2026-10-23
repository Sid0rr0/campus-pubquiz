import { describe, expect, it } from 'vitest';
import {
  getActiveBlockStartIndex,
  isLastQuestionBeforeBreak,
  isShowdownEligible,
} from '../admin-view-flags';
import type { GameProgress } from '../game-state';
import type { SeededRound, SessionState } from '../session-state';
import { round, sessionWith } from './session-fixtures';

// Rounds 1 and 2 share a block (round 1 has no break), round 3 is its own, and
// round 4 is a kahoot round where every question is its own block.
const ROUNDS: SeededRound[] = [
  round(1, [1, 2], { breakAfter: false }),
  round(2, [3, 4]),
  round(3, [5]),
  round(4, [6, 7], { kahootMode: true }),
];

function at(
  progress: Partial<GameProgress>,
  overrides: Partial<SessionState> = {},
  rounds: SeededRound[] = ROUNDS,
): SessionState {
  return sessionWith(rounds, progress, overrides);
}

describe('getActiveBlockStartIndex', () => {
  it('is the round the block started in when the block spans rounds', () => {
    expect(getActiveBlockStartIndex(at({ roundIndex: 1 }))).toBe(0);
  });

  it('is the current round when it starts its own block', () => {
    expect(getActiveBlockStartIndex(at({ roundIndex: 2 }))).toBe(2);
  });

  it('is the current round for a question of a kahoot round', () => {
    expect(
      getActiveBlockStartIndex(at({ roundIndex: 3, questionIndex: 1 })),
    ).toBe(3);
  });

  it('is 0 when progress names a round past the quiz', () => {
    expect(getActiveBlockStartIndex(at({ roundIndex: ROUNDS.length }))).toBe(0);
  });

  it('is 0 for a quiz without rounds', () => {
    expect(getActiveBlockStartIndex(at({}, {}, []))).toBe(0);
  });
});

describe('isShowdownEligible', () => {
  const finalRound = ROUNDS.length - 1;

  it('is true on the final round once everything is graded', () => {
    expect(
      isShowdownEligible(at({ status: 'break', roundIndex: finalRound })),
    ).toBe(true);
  });

  it('is true once the quiz has ended', () => {
    expect(
      isShowdownEligible(at({ status: 'ended', roundIndex: finalRound })),
    ).toBe(true);
  });

  it('is false before the final round', () => {
    expect(
      isShowdownEligible(at({ status: 'break', roundIndex: finalRound - 1 })),
    ).toBe(false);
  });

  it('is false while an answer is still ungraded', () => {
    expect(
      isShowdownEligible(
        at(
          { status: 'break', roundIndex: finalRound },
          { ungradedQuestionIds: [6] },
        ),
      ),
    ).toBe(false);
  });

  it('is false in a status where grading is not settled', () => {
    expect(
      isShowdownEligible(at({ status: 'locking', roundIndex: finalRound })),
    ).toBe(false);
  });

  it('is false for a quiz without rounds', () => {
    expect(isShowdownEligible(at({ status: 'ended' }, {}, []))).toBe(false);
  });
});

describe('isLastQuestionBeforeBreak', () => {
  it('is true on the last question of a round that has a break after it', () => {
    expect(
      isLastQuestionBeforeBreak(
        at({ status: 'question_open', roundIndex: 1, questionIndex: 1 }),
      ),
    ).toBe(true);
  });

  it('is true while that question is locking', () => {
    expect(
      isLastQuestionBeforeBreak(
        at({ status: 'locking', roundIndex: 1, questionIndex: 1 }),
      ),
    ).toBe(true);
  });

  it('is false on an earlier question of that round', () => {
    expect(
      isLastQuestionBeforeBreak(
        at({ status: 'question_open', roundIndex: 1, questionIndex: 0 }),
      ),
    ).toBe(false);
  });

  it('is false on the last question of a round with no break after it', () => {
    expect(
      isLastQuestionBeforeBreak(
        at({ status: 'question_open', roundIndex: 0, questionIndex: 1 }),
      ),
    ).toBe(false);
  });

  it('is true on any question of a kahoot round', () => {
    expect(
      isLastQuestionBeforeBreak(
        at({ status: 'question_open', roundIndex: 3, questionIndex: 0 }),
      ),
    ).toBe(true);
  });

  it('is false once the break has begun', () => {
    expect(
      isLastQuestionBeforeBreak(
        at({ status: 'break_intro', roundIndex: 1, questionIndex: 1 }),
      ),
    ).toBe(false);
  });

  it('is false when progress names a round past the quiz', () => {
    expect(
      isLastQuestionBeforeBreak(
        at({ status: 'question_open', roundIndex: ROUNDS.length }),
      ),
    ).toBe(false);
  });
});
