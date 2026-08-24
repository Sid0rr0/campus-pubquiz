import { describe, expect, it } from 'vitest';
import {
  getBlockStartRoundIndex,
  getBreakNumber,
  getQuizStructureSummary,
  isLastQuestionOfBreakAfterRound,
  isShowingLastBreak,
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

describe('getBreakNumber', () => {
  it('returns 0 for a round that is not a block-ending round', () => {
    expect(
      getBreakNumber(0, {
        blockCount: 0,
        topicsPerBlock: null,
        breakRoundNumbers: [],
        minQuestionsPerTopic: 0,
        maxQuestionsPerTopic: 0,
      }),
    ).toBe(0);
  });

  it('numbers each break in order, starting from 1', () => {
    const threeBlocksSummary = getQuizStructureSummary({
      rounds: [
        { questionCount: 1, breakAfter: false },
        { questionCount: 1, breakAfter: true },
        { questionCount: 1, breakAfter: false },
        { questionCount: 1, breakAfter: true },
        { questionCount: 1, breakAfter: false },
        { questionCount: 1, breakAfter: true },
      ],
    });
    // roundIndex 1 (round "2") ends the first break.
    expect(getBreakNumber(1, threeBlocksSummary)).toBe(1);
    // roundIndex 3 (round "4") ends the second break.
    expect(getBreakNumber(3, threeBlocksSummary)).toBe(2);
    // roundIndex 5 (round "6") ends the third break.
    expect(getBreakNumber(5, threeBlocksSummary)).toBe(3);
  });

  it('numbers a single-block quiz’s only break as 1', () => {
    expect(
      getBreakNumber(1, getQuizStructureSummary(twoRoundsWithBreakAfterSecond)),
    ).toBe(1);
  });
});

describe('isShowingLastBreak', () => {
  const threeBlocksSummary = getQuizStructureSummary({
    rounds: [
      { questionCount: 1, breakAfter: false },
      { questionCount: 1, breakAfter: true },
      { questionCount: 1, breakAfter: false },
      { questionCount: 1, breakAfter: true },
      { questionCount: 1, breakAfter: false },
      { questionCount: 1, breakAfter: true },
    ],
  });

  function progressAt(
    status: GameProgress['status'],
    roundIndex: number,
  ): GameProgress {
    return {
      status,
      roundIndex,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
  }

  it('is false outside a break-related status, even during the last break’s round', () => {
    expect(
      isShowingLastBreak(progressAt('reveal', 5), threeBlocksSummary),
    ).toBe(false);
    expect(
      isShowingLastBreak(progressAt('question_open', 5), threeBlocksSummary),
    ).toBe(false);
  });

  it('is false during an earlier break, even in a break-related status', () => {
    expect(
      isShowingLastBreak(progressAt('break_intro', 1), threeBlocksSummary),
    ).toBe(false);
    expect(isShowingLastBreak(progressAt('break', 3), threeBlocksSummary)).toBe(
      false,
    );
  });

  it('is true for every break-related status during the quiz’s last break', () => {
    expect(
      isShowingLastBreak(progressAt('break_intro', 5), threeBlocksSummary),
    ).toBe(true);
    expect(isShowingLastBreak(progressAt('break', 5), threeBlocksSummary)).toBe(
      true,
    );
    expect(
      isShowingLastBreak(
        progressAt('break_round_intro', 5),
        threeBlocksSummary,
      ),
    ).toBe(true);
  });

  it('is true for a single-block quiz’s only break, since it is also the last one', () => {
    expect(
      isShowingLastBreak(
        progressAt('break_intro', 1),
        getQuizStructureSummary(twoRoundsWithBreakAfterSecond),
      ),
    ).toBe(true);
  });
});

describe('getQuizStructureSummary', () => {
  it('counts one block and its topic count for a single-block quiz', () => {
    expect(getQuizStructureSummary(twoRoundsWithBreakAfterSecond)).toEqual({
      blockCount: 1,
      topicsPerBlock: 2,
      breakRoundNumbers: [2],
      minQuestionsPerTopic: 2,
      maxQuestionsPerTopic: 2,
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
      breakRoundNumbers: [2, 4, 6],
      minQuestionsPerTopic: 1,
      maxQuestionsPerTopic: 1,
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
      breakRoundNumbers: [1, 3],
      minQuestionsPerTopic: 1,
      maxQuestionsPerTopic: 1,
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
      breakRoundNumbers: [1, 2],
      minQuestionsPerTopic: 1,
      maxQuestionsPerTopic: 1,
    });
  });

  it('reports differing min/max question counts when rounds are not uniform', () => {
    const unevenQuestionCounts: GameContext = {
      rounds: [
        { questionCount: 3, breakAfter: false },
        { questionCount: 5, breakAfter: true },
      ],
    };
    expect(getQuizStructureSummary(unevenQuestionCounts)).toEqual({
      blockCount: 1,
      topicsPerBlock: 2,
      breakRoundNumbers: [2],
      minQuestionsPerTopic: 3,
      maxQuestionsPerTopic: 5,
    });
  });

  it('reports min and max as 0 for a quiz with no rounds', () => {
    expect(getQuizStructureSummary({ rounds: [] })).toEqual({
      blockCount: 0,
      topicsPerBlock: null,
      breakRoundNumbers: [],
      minQuestionsPerTopic: 0,
      maxQuestionsPerTopic: 0,
    });
  });
});
