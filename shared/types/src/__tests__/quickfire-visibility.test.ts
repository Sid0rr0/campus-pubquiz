import { describe, expect, it } from 'vitest';
import type { GameProgress } from '../game-state';
import {
  currentQuickfireQuestionId,
  isCurrentQuickfireQuestionRevealed,
  isCurrentRoundQuickfire,
  isQuestionHiddenBehindQuickfireLeaderboard,
} from '../quickfire-visibility';
import { round, sessionWith } from './session-fixtures';

const ROUNDS = [round(1, [1]), round(2, [2, 3], { quickfire: true })];

function at(progress: Partial<GameProgress>) {
  return sessionWith(ROUNDS, progress);
}

describe('isCurrentRoundQuickfire', () => {
  it('is true on a quickfire round', () => {
    expect(isCurrentRoundQuickfire(at({ roundIndex: 1 }))).toBe(true);
  });

  it('is false on a round without quickfire', () => {
    expect(isCurrentRoundQuickfire(at({ roundIndex: 0 }))).toBe(false);
  });

  it('is false when progress names a round past the quiz', () => {
    expect(isCurrentRoundQuickfire(at({ roundIndex: 2 }))).toBe(false);
  });
});

describe('isQuestionHiddenBehindQuickfireLeaderboard', () => {
  const behindBoard: Partial<GameProgress> = {
    status: 'question_open',
    roundIndex: 1,
    isLeaderboardVisible: true,
  };

  it('is true for an open quickfire question while the leaderboard covers it', () => {
    expect(isQuestionHiddenBehindQuickfireLeaderboard(at(behindBoard))).toBe(
      true,
    );
  });

  it('is false once the leaderboard is hidden', () => {
    expect(
      isQuestionHiddenBehindQuickfireLeaderboard(
        at({ ...behindBoard, isLeaderboardVisible: false }),
      ),
    ).toBe(false);
  });

  it('is false outside a quickfire round', () => {
    expect(
      isQuestionHiddenBehindQuickfireLeaderboard(
        at({ ...behindBoard, roundIndex: 0 }),
      ),
    ).toBe(false);
  });

  it('is false when no question is being answered', () => {
    expect(
      isQuestionHiddenBehindQuickfireLeaderboard(
        at({ ...behindBoard, status: 'reveal' }),
      ),
    ).toBe(false);
  });
});

describe('isCurrentQuickfireQuestionRevealed', () => {
  const onQuestion = (
    progress: Partial<GameProgress>,
    revealedQuickfireQuestionIds: number[],
  ) => sessionWith(ROUNDS, progress, { revealedQuickfireQuestionIds });

  it('is true on a quickfire question whose reveal already aired, even back on its locking countdown', () => {
    expect(
      isCurrentQuickfireQuestionRevealed(
        onQuestion({ status: 'locking', roundIndex: 1, questionIndex: 0 }, [2]),
      ),
    ).toBe(true);
  });

  it('is false on a quickfire question whose reveal has not aired, though another one has', () => {
    expect(
      isCurrentQuickfireQuestionRevealed(
        onQuestion({ status: 'locking', roundIndex: 1, questionIndex: 1 }, [2]),
      ),
    ).toBe(false);
  });

  it('is false when no quickfire question was revealed', () => {
    expect(
      isCurrentQuickfireQuestionRevealed(
        onQuestion({ status: 'locking', roundIndex: 1, questionIndex: 0 }, []),
      ),
    ).toBe(false);
  });

  it('is false outside a quickfire round, whatever the list holds', () => {
    expect(
      isCurrentQuickfireQuestionRevealed(
        onQuestion({ status: 'locking', roundIndex: 0, questionIndex: 0 }, [1]),
      ),
    ).toBe(false);
  });

  it('is false when progress names a question past the round', () => {
    expect(
      isCurrentQuickfireQuestionRevealed(
        onQuestion({ status: 'locking', roundIndex: 1, questionIndex: 5 }, [2]),
      ),
    ).toBe(false);
  });
});

describe('currentQuickfireQuestionId', () => {
  const idAt = (progress: Partial<GameProgress>) =>
    currentQuickfireQuestionId(ROUNDS, { ...at(progress).progress });

  it('is the id of the question progress stands on in a quickfire round', () => {
    expect(idAt({ roundIndex: 1, questionIndex: 0 })).toBe(2);
    expect(idAt({ roundIndex: 1, questionIndex: 1 })).toBe(3);
  });

  it('is undefined in a round that is not quickfire', () => {
    expect(idAt({ roundIndex: 0, questionIndex: 0 })).toBeUndefined();
  });

  it('is undefined for a position past the round or the quiz', () => {
    expect(idAt({ roundIndex: 1, questionIndex: 5 })).toBeUndefined();
    expect(idAt({ roundIndex: 2, questionIndex: 0 })).toBeUndefined();
  });
});
