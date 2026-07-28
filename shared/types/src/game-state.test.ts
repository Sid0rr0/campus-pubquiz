import { describe, expect, it } from 'vitest';
import {
  getBlockStartRoundIndex,
  getNextGameState,
  getQuizStructureSummary,
  IllegalGameTransitionError,
  InvalidQuizConfigError,
  type GameContext,
  type GameProgress,
} from './game-state';

const twoRoundsWithBreakAfterSecond: GameContext = {
  rounds: [
    { questionCount: 2, breakAfter: false },
    { questionCount: 2, breakAfter: true },
  ],
};

const lobby: GameProgress = {
  status: 'lobby',
  roundIndex: 0,
  questionIndex: 0,
  isLeaderboardVisible: false,
  revealIndex: 0,
};

describe('getNextGameState', () => {
  it('starts the quiz into the rules screen before any question opens', () => {
    const next = getNextGameState(lobby, 'START_QUIZ', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({
      status: 'rules',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
  });

  it('opens the first question of round 0 when advancing past the rules screen', () => {
    const rules: GameProgress = { ...lobby, status: 'rules' };
    const next = getNextGameState(rules, 'ADVANCE', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
  });

  it('rejects moving back from the rules screen', () => {
    const rules: GameProgress = { ...lobby, status: 'rules' };
    expect(() => getNextGameState(rules, 'PREVIOUS', twoRoundsWithBreakAfterSecond)).toThrow(
      IllegalGameTransitionError,
    );
  });

  it('advances to the next question within the same round while answers stay open', () => {
    const open: GameProgress = {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    };
    const next = getNextGameState(open, 'ADVANCE', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
  });

  it('moves to the next round without a break when the finished round has breakAfter: false', () => {
    const open: GameProgress = {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1, // last question of round 0 (questionCount: 2)
      isLeaderboardVisible: false,
      revealIndex: 0,
    };
    const next = getNextGameState(open, 'ADVANCE', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
  });

  it('locks the whole block by entering a break when the finished round has breakAfter: true', () => {
    const open: GameProgress = {
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 1, // last question of round 1 (breakAfter: true)
      isLeaderboardVisible: false,
      revealIndex: 0,
    };
    const next = getNextGameState(open, 'ADVANCE', twoRoundsWithBreakAfterSecond);
    expect(next.status).toBe('break');
    expect(next.roundIndex).toBe(1);
  });

  it('moves from break to reveal once grading is finished, starting at the first reveal question', () => {
    const grading: GameProgress = {
      status: 'break',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
    };
    const next = getNextGameState(grading, 'FINISH_GRADING', twoRoundsWithBreakAfterSecond);
    expect(next.status).toBe('reveal');
    expect(next.revealIndex).toBe(0);
  });

  it('steps to the next question within reveal before leaving the block (same block spans 2 rounds, 4 questions)', () => {
    const revealing: GameProgress = {
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
    };
    const next = getNextGameState(revealing, 'ADVANCE', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 1,
    });
  });

  it('ends the quiz from reveal once the last question of the last block has been shown', () => {
    const revealing: GameProgress = {
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 3, // last of 4 questions in the 2-round block
    };
    const next = getNextGameState(revealing, 'ADVANCE', twoRoundsWithBreakAfterSecond);
    expect(next.status).toBe('ended');
    expect(next.revealIndex).toBe(0);
  });

  it('continues to the next round from reveal once the last question of the finished block has been shown', () => {
    const threeRounds: GameContext = {
      rounds: [
        { questionCount: 1, breakAfter: true },
        { questionCount: 1, breakAfter: false },
        { questionCount: 1, breakAfter: true },
      ],
    };
    const revealing: GameProgress = {
      status: 'reveal',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0, // round 0 alone is a 1-question block
    };
    const next = getNextGameState(revealing, 'ADVANCE', threeRounds);
    expect(next).toEqual({
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
  });

  it('moves back to the previous reveal question', () => {
    const revealing: GameProgress = {
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 2,
    };
    const next = getNextGameState(revealing, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({ ...revealing, revealIndex: 1 });
  });

  it('rejects moving back past the first reveal question', () => {
    const revealing: GameProgress = {
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
    };
    expect(() => getNextGameState(revealing, 'PREVIOUS', twoRoundsWithBreakAfterSecond)).toThrow(
      IllegalGameTransitionError,
    );
  });

  it('toggles the leaderboard on without changing the underlying status', () => {
    const open: GameProgress = {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    };
    const next = getNextGameState(open, 'TOGGLE_LEADERBOARD', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({ ...open, isLeaderboardVisible: true });
  });

  it('toggles the leaderboard back off, resuming the prior status untouched', () => {
    const openWithLeaderboard: GameProgress = {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: true,
      revealIndex: 0,
    };
    const next = getNextGameState(openWithLeaderboard, 'TOGGLE_LEADERBOARD', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({ ...openWithLeaderboard, isLeaderboardVisible: false });
  });

  it('allows toggling the leaderboard even after the quiz has ended', () => {
    const ended: GameProgress = {
      status: 'ended',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
    };
    const next = getNextGameState(ended, 'TOGGLE_LEADERBOARD', twoRoundsWithBreakAfterSecond);
    expect(next.isLeaderboardVisible).toBe(true);
    expect(next.status).toBe('ended');
  });

  it('force-ends the quiz from any in-progress status', () => {
    const grading: GameProgress = {
      status: 'break',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
    };
    const next = getNextGameState(grading, 'END_QUIZ', twoRoundsWithBreakAfterSecond);
    expect(next.status).toBe('ended');
  });

  it('rejects advancing from the lobby', () => {
    expect(() => getNextGameState(lobby, 'ADVANCE', twoRoundsWithBreakAfterSecond)).toThrow(
      IllegalGameTransitionError,
    );
  });

  it('rejects starting a quiz that is already open', () => {
    const open: GameProgress = { ...lobby, status: 'question_open' };
    expect(() => getNextGameState(open, 'START_QUIZ', twoRoundsWithBreakAfterSecond)).toThrow(
      IllegalGameTransitionError,
    );
  });

  it('rejects finishing grading outside of a break', () => {
    const open: GameProgress = { ...lobby, status: 'question_open' };
    expect(() => getNextGameState(open, 'FINISH_GRADING', twoRoundsWithBreakAfterSecond)).toThrow(
      IllegalGameTransitionError,
    );
  });

  it('rejects ending a quiz that has already ended', () => {
    const ended: GameProgress = {
      status: 'ended',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
    };
    expect(() => getNextGameState(ended, 'END_QUIZ', twoRoundsWithBreakAfterSecond)).toThrow(
      IllegalGameTransitionError,
    );
  });

  it('rejects advancing once the quiz has ended', () => {
    const ended: GameProgress = {
      status: 'ended',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
    };
    expect(() => getNextGameState(ended, 'ADVANCE', twoRoundsWithBreakAfterSecond)).toThrow(
      IllegalGameTransitionError,
    );
  });

  it('rejects a config where the last round has no break (answers could never be revealed)', () => {
    const badContext: GameContext = {
      rounds: [{ questionCount: 1, breakAfter: false }],
    };
    const open: GameProgress = {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    };
    expect(() => getNextGameState(open, 'ADVANCE', badContext)).toThrow(InvalidQuizConfigError);
  });

  it('moves back to the previous question within the same round', () => {
    const open: GameProgress = {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
    };
    const next = getNextGameState(open, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
  });

  it('moves back to the last question of the previous round within the same open block', () => {
    const open: GameProgress = {
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0, // first question of round 1, still the same open block as round 0
      isLeaderboardVisible: false,
      revealIndex: 0,
    };
    const next = getNextGameState(open, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1, // last question of round 0 (questionCount: 2)
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
  });

  it('rejects moving back past the start of the first block', () => {
    const open: GameProgress = {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    };
    expect(() => getNextGameState(open, 'PREVIOUS', twoRoundsWithBreakAfterSecond)).toThrow(
      IllegalGameTransitionError,
    );
  });

  it('rejects moving back into a previous block that already locked and started grading', () => {
    const breakFirstThenTwo: GameContext = {
      rounds: [
        { questionCount: 1, breakAfter: true },
        { questionCount: 2, breakAfter: true },
      ],
    };
    const open: GameProgress = {
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0, // first question of round 1, a new block after round 0's break
      isLeaderboardVisible: false,
      revealIndex: 0,
    };
    expect(() => getNextGameState(open, 'PREVIOUS', breakFirstThenTwo)).toThrow(
      IllegalGameTransitionError,
    );
  });

  it('rejects moving back outside of question_open or reveal', () => {
    const grading: GameProgress = {
      status: 'break',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
    };
    expect(() => getNextGameState(grading, 'PREVIOUS', twoRoundsWithBreakAfterSecond)).toThrow(
      IllegalGameTransitionError,
    );
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
