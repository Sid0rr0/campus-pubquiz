import { describe, expect, it } from 'vitest';
import type { GameProgress } from '../game-state';
import {
  isCurrentKahootQuestionRevealed,
  isCurrentRoundKahoot,
  isQuestionHiddenBehindKahootLeaderboard,
} from '../kahoot-visibility';
import { round, sessionWith } from './session-fixtures';

const ROUNDS = [round(1, [1]), round(2, [2, 3], { kahootMode: true })];

function at(progress: Partial<GameProgress>) {
  return sessionWith(ROUNDS, progress);
}

describe('isCurrentRoundKahoot', () => {
  it('is true on a kahoot round', () => {
    expect(isCurrentRoundKahoot(at({ roundIndex: 1 }))).toBe(true);
  });

  it('is false on a round without kahootMode', () => {
    expect(isCurrentRoundKahoot(at({ roundIndex: 0 }))).toBe(false);
  });

  it('is false when progress names a round past the quiz', () => {
    expect(isCurrentRoundKahoot(at({ roundIndex: 2 }))).toBe(false);
  });
});

describe('isQuestionHiddenBehindKahootLeaderboard', () => {
  const behindBoard: Partial<GameProgress> = {
    status: 'question_open',
    roundIndex: 1,
    isLeaderboardVisible: true,
  };

  it('is true for an open kahoot question while the leaderboard covers it', () => {
    expect(isQuestionHiddenBehindKahootLeaderboard(at(behindBoard))).toBe(true);
  });

  it('is false once the leaderboard is hidden', () => {
    expect(
      isQuestionHiddenBehindKahootLeaderboard(
        at({ ...behindBoard, isLeaderboardVisible: false }),
      ),
    ).toBe(false);
  });

  it('is false outside a kahoot round', () => {
    expect(
      isQuestionHiddenBehindKahootLeaderboard(
        at({ ...behindBoard, roundIndex: 0 }),
      ),
    ).toBe(false);
  });

  it('is false when no question is being answered', () => {
    expect(
      isQuestionHiddenBehindKahootLeaderboard(
        at({ ...behindBoard, status: 'reveal' }),
      ),
    ).toBe(false);
  });
});

describe('isCurrentKahootQuestionRevealed', () => {
  const onQuestion = (
    progress: Partial<GameProgress>,
    revealedKahootQuestionIds: number[],
  ) => sessionWith(ROUNDS, progress, { revealedKahootQuestionIds });

  it('is true on a kahoot question whose reveal already aired, even back on its locking countdown', () => {
    expect(
      isCurrentKahootQuestionRevealed(
        onQuestion({ status: 'locking', roundIndex: 1, questionIndex: 0 }, [2]),
      ),
    ).toBe(true);
  });

  it('is false on a kahoot question whose reveal has not aired, though another one has', () => {
    expect(
      isCurrentKahootQuestionRevealed(
        onQuestion({ status: 'locking', roundIndex: 1, questionIndex: 1 }, [2]),
      ),
    ).toBe(false);
  });

  it('is false when no kahoot question was revealed', () => {
    expect(
      isCurrentKahootQuestionRevealed(
        onQuestion({ status: 'locking', roundIndex: 1, questionIndex: 0 }, []),
      ),
    ).toBe(false);
  });

  it('is false outside a kahoot round, whatever the list holds', () => {
    expect(
      isCurrentKahootQuestionRevealed(
        onQuestion({ status: 'locking', roundIndex: 0, questionIndex: 0 }, [1]),
      ),
    ).toBe(false);
  });

  it('is false when progress names a question past the round', () => {
    expect(
      isCurrentKahootQuestionRevealed(
        onQuestion({ status: 'locking', roundIndex: 1, questionIndex: 5 }, [2]),
      ),
    ).toBe(false);
  });
});
