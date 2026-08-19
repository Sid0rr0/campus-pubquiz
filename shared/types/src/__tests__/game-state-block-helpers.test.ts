import { describe, expect, it } from 'vitest';
import {
  getBlockStartRoundIndex,
  getQuizStructureSummary,
  isLastQuestionOfBreakAfterRound,
  type GameContext,
  type GameProgress,
} from '../game-state';
import { twoRoundsWithBreakAfterSecond } from './game-state-fixtures';

describe('isLastQuestionOfBreakAfterRound', () => {
  it('is true on the last question of a round with breakAfter: true', () => {
    const progress: GameProgress = {
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 1, // last question of round 1 (questionCount: 2)
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    expect(
      isLastQuestionOfBreakAfterRound(progress, twoRoundsWithBreakAfterSecond),
    ).toBe(true);
  });

  it('is false on an earlier question of a round with breakAfter: true', () => {
    const progress: GameProgress = {
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0, // first of two questions in round 1
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    expect(
      isLastQuestionOfBreakAfterRound(progress, twoRoundsWithBreakAfterSecond),
    ).toBe(false);
  });

  it('is false on the last question of a round with breakAfter: false', () => {
    const progress: GameProgress = {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1, // last question of round 0 (breakAfter: false)
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    expect(
      isLastQuestionOfBreakAfterRound(progress, twoRoundsWithBreakAfterSecond),
    ).toBe(false);
  });
});

describe('getBlockStartRoundIndex', () => {
  const fourRounds: GameContext = {
    rounds: [
      { questionCount: 2, breakAfter: false },
      { questionCount: 2, breakAfter: true },
      { questionCount: 1, breakAfter: false },
      { questionCount: 1, breakAfter: true },
    ],
  };

  it('returns round 0 for any round in the first block', () => {
    expect(getBlockStartRoundIndex(0, fourRounds)).toBe(0);
  });

  it('includes the breakAfter round itself at the end of its own block', () => {
    expect(getBlockStartRoundIndex(1, fourRounds)).toBe(0);
  });

  it('starts a new block on the round following a breakAfter round', () => {
    expect(getBlockStartRoundIndex(2, fourRounds)).toBe(2);
    expect(getBlockStartRoundIndex(3, fourRounds)).toBe(2);
  });
});

describe('getQuizStructureSummary', () => {
  it('counts one block and its topic count for a single-block quiz', () => {
    expect(getQuizStructureSummary(twoRoundsWithBreakAfterSecond)).toEqual({
      blockCount: 1,
      topicsPerBlock: 2,
    });
  });

  it('counts multiple blocks when every block has the same number of topics', () => {
    const threeBlocksOfTwo: GameContext = {
      rounds: [
        { questionCount: 1, breakAfter: false },
        { questionCount: 1, breakAfter: true },
        { questionCount: 1, breakAfter: false },
        { questionCount: 1, breakAfter: true },
        { questionCount: 1, breakAfter: false },
        { questionCount: 1, breakAfter: true },
      ],
    };
    expect(getQuizStructureSummary(threeBlocksOfTwo)).toEqual({
      blockCount: 3,
      topicsPerBlock: 2,
    });
  });

  it('reports topicsPerBlock as null when blocks have differing topic counts', () => {
    const unevenBlocks: GameContext = {
      rounds: [
        { questionCount: 1, breakAfter: true },
        { questionCount: 1, breakAfter: false },
        { questionCount: 1, breakAfter: true },
      ],
    };
    expect(getQuizStructureSummary(unevenBlocks)).toEqual({
      blockCount: 2,
      topicsPerBlock: null,
    });
  });

  it('counts a trailing block that has not been closed by a breakAfter round yet', () => {
    const trailingOpenBlock: GameContext = {
      rounds: [
        { questionCount: 1, breakAfter: true },
        { questionCount: 1, breakAfter: false },
      ],
    };
    expect(getQuizStructureSummary(trailingOpenBlock)).toEqual({
      blockCount: 2,
      topicsPerBlock: 1,
    });
  });
});
