import { describe, expect, it } from 'vitest';
import {
  getNextGameState,
  getTimedPhaseKey,
  type GameContext,
  type GameProgress,
} from '../game-state';
import { twoRoundsWithBreakAfterSecond } from './game-state-fixtures';

function progressAt(overrides: Partial<GameProgress>): GameProgress {
  return {
    status: 'question_open',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    revealIndex: 0,
    furthestOpenIndex: 0,
    ...overrides,
  };
}

describe('getTimedPhaseKey', () => {
  it('returns the same key for question_open and locking on the same question', () => {
    const open = progressAt({ status: 'question_open', roundIndex: 0, questionIndex: 0 });
    const locking = progressAt({ status: 'locking', roundIndex: 0, questionIndex: 0 });
    expect(getTimedPhaseKey(open, twoRoundsWithBreakAfterSecond)).toBe(
      getTimedPhaseKey(locking, twoRoundsWithBreakAfterSecond),
    );
  });

  it('returns a different key across a question-index change', () => {
    const q1 = progressAt({ status: 'question_open', roundIndex: 0, questionIndex: 0 });
    const q2 = progressAt({ status: 'question_open', roundIndex: 0, questionIndex: 1 });
    expect(getTimedPhaseKey(q1, twoRoundsWithBreakAfterSecond)).not.toBe(
      getTimedPhaseKey(q2, twoRoundsWithBreakAfterSecond),
    );
  });

  it('returns a different key across a round boundary', () => {
    const lastOfRound0 = progressAt({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
    });
    const firstOfRound1 = progressAt({
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0,
    });
    expect(getTimedPhaseKey(lastOfRound0, twoRoundsWithBreakAfterSecond)).not.toBe(
      getTimedPhaseKey(firstOfRound1, twoRoundsWithBreakAfterSecond),
    );
  });

  it('returns the same key across break_intro/break/break_round_intro for one block', () => {
    const breakIntro = progressAt({ status: 'break_intro', roundIndex: 1 });
    const breakStatus = progressAt({ status: 'break', roundIndex: 1 });
    const breakRoundIntro = progressAt({ status: 'break_round_intro', roundIndex: 1 });
    const key = getTimedPhaseKey(breakIntro, twoRoundsWithBreakAfterSecond);
    expect(key).not.toBeNull();
    expect(getTimedPhaseKey(breakStatus, twoRoundsWithBreakAfterSecond)).toBe(key);
    expect(getTimedPhaseKey(breakRoundIntro, twoRoundsWithBreakAfterSecond)).toBe(key);
  });

  it('returns a different key for two different blocks', () => {
    const threeBlocks: GameContext = {
      rounds: [
        { questionCount: 1, breakAfter: true },
        { questionCount: 1, breakAfter: true },
      ],
    };
    const firstBreak = progressAt({ status: 'break', roundIndex: 0 });
    const secondBreak = progressAt({ status: 'break', roundIndex: 1 });
    expect(getTimedPhaseKey(firstBreak, threeBlocks)).not.toBe(
      getTimedPhaseKey(secondBreak, threeBlocks),
    );
  });

  it.each(['lobby', 'rules', 'round_intro', 'reveal_intro', 'reveal', 'ended'] as const)(
    'returns null for untimed status %s',
    (status) => {
      expect(
        getTimedPhaseKey(progressAt({ status }), twoRoundsWithBreakAfterSecond),
      ).toBeNull();
    },
  );

  it('preserves a live status’s key across an END_QUIZ -> PREVIOUS round trip', () => {
    const live = progressAt({ status: 'question_open', roundIndex: 0, questionIndex: 1 });
    const keyBefore = getTimedPhaseKey(live, twoRoundsWithBreakAfterSecond);

    const ended = getNextGameState(live, 'END_QUIZ', twoRoundsWithBreakAfterSecond);
    const restored = getNextGameState(
      ended,
      'PREVIOUS',
      twoRoundsWithBreakAfterSecond,
    );

    expect(getTimedPhaseKey(restored, twoRoundsWithBreakAfterSecond)).toBe(keyBefore);
  });
});
