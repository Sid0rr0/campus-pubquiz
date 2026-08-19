import { describe, expect, it } from 'vitest';
import {
  getNextGameState,
  type GameContext,
  type GameProgress,
} from '../game-state';
import { lobby, twoRoundsWithBreakAfterSecond } from './game-state-fixtures';

describe('getNextGameState — forward (ADVANCE) transitions', () => {
  it('starts the quiz into the rules screen before any question opens', () => {
    const next = getNextGameState(
      lobby,
      'START_QUIZ',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({
      status: 'rules',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    });
  });

  it("shows round 0's intro card when advancing past the rules screen", () => {
    const rules: GameProgress = { ...lobby, status: 'rules' };
    const next = getNextGameState(
      rules,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({
      status: 'round_intro',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    });
  });

  it('opens the first question of the round when advancing past its intro card', () => {
    const roundIntro: GameProgress = { ...lobby, status: 'round_intro' };
    const next = getNextGameState(
      roundIntro,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    });
  });

  it('advances to the next question within the same round while answers stay open', () => {
    const open: GameProgress = {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      open,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      // Just opened for the first time — furthestOpenIndex tracks forward
      // with it, block position 1 (round 0's second question).
      furthestOpenIndex: 1,
    });
  });

  it("shows the next round's intro card when the finished round has breakAfter: false", () => {
    const open: GameProgress = {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1, // last question of round 0 (questionCount: 2)
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      open,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({
      status: 'round_intro',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    });
  });

  it('enters the locking countdown when the finished round has breakAfter: true', () => {
    const open: GameProgress = {
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 1, // last question of round 1 (breakAfter: true)
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      open,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next.status).toBe('locking');
    expect(next.roundIndex).toBe(1);
    expect(next.questionIndex).toBe(1);
  });

  it("enters break_intro once the locking countdown is advanced past, pinned to the block's last question", () => {
    const locking: GameProgress = {
      status: 'locking',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      locking,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({ ...locking, status: 'break_intro', revealIndex: 3 }); // last of 4 questions in the 2-round block
  });

  it('skips straight to reveal_intro when Advance is pressed from break_intro', () => {
    const breakIntro: GameProgress = {
      status: 'break_intro',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 3,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      breakIntro,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({
      ...breakIntro,
      status: 'reveal_intro',
      revealIndex: 0,
    });
  });

  it('moves from break to a reveal round intro card once Advance is pressed, before any answer is shown', () => {
    const grading: GameProgress = {
      status: 'break',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      grading,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next.status).toBe('reveal_intro');
    expect(next.revealIndex).toBe(0);
  });

  it('moves from a reveal round intro card into reveal once Advance is pressed again, same position', () => {
    const revealIntro: GameProgress = {
      status: 'reveal_intro',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      revealIntro,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({ ...revealIntro, status: 'reveal' });
  });

  it('steps to the next question within reveal while staying in the same round', () => {
    const revealing: GameProgress = {
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 2, // round 1's first question within the 2-round block
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      revealing,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 3,
      furthestOpenIndex: 0,
    });
  });

  it("shows the next round's own intro card when reveal crosses a round boundary within the same block", () => {
    const revealing: GameProgress = {
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 1, // round 0's last question within the 2-round block
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      revealing,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({
      status: 'reveal_intro',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 2, // round 1's first question
      furthestOpenIndex: 0,
    });
  });

  it('ends the quiz from reveal once the last question of the last block has been shown', () => {
    const revealing: GameProgress = {
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 3, // last of 4 questions in the 2-round block
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      revealing,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next.status).toBe('ended');
    expect(next.revealIndex).toBe(0);
  });

  it('shows the leaderboard immediately when advancing past the last reveal question ends the quiz', () => {
    const revealing: GameProgress = {
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 3, // last of 4 questions in the 2-round block
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      revealing,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next.isLeaderboardVisible).toBe(true);
  });

  it("shows the next round's intro card from reveal once the last question of the finished block has been shown", () => {
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
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(revealing, 'ADVANCE', threeRounds);
    expect(next).toEqual({
      status: 'round_intro',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: -1,
    });
  });
});
