import { describe, expect, it } from 'vitest';
import {
  getNextGameState,
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
};

describe('getNextGameState', () => {
  it('starts the quiz at round 0, question 0', () => {
    const next = getNextGameState(lobby, 'START_QUIZ', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
    });
  });

  it('locks answers for the open question', () => {
    const open: GameProgress = { ...lobby, status: 'question_open' };
    const next = getNextGameState(open, 'LOCK_ANSWERS', twoRoundsWithBreakAfterSecond);
    expect(next.status).toBe('locked');
  });

  it('advances to the next question within the same round', () => {
    const locked: GameProgress = {
      status: 'locked',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
    };
    const next = getNextGameState(locked, 'ADVANCE', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
    });
  });

  it('moves to the next round when the finished round has no break', () => {
    const locked: GameProgress = {
      status: 'locked',
      roundIndex: 0,
      questionIndex: 1, // last question of round 0 (questionCount: 2)
      isLeaderboardVisible: false,
    };
    const next = getNextGameState(locked, 'ADVANCE', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: false,
    });
  });

  it('enters a break when the finished round requires one', () => {
    const locked: GameProgress = {
      status: 'locked',
      roundIndex: 1,
      questionIndex: 1, // last question of round 1 (breakAfter: true)
      isLeaderboardVisible: false,
    };
    const next = getNextGameState(locked, 'ADVANCE', twoRoundsWithBreakAfterSecond);
    expect(next.status).toBe('break');
    expect(next.roundIndex).toBe(1);
  });

  it('moves from break to reveal once grading is finished', () => {
    const grading: GameProgress = {
      status: 'break',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
    };
    const next = getNextGameState(grading, 'FINISH_GRADING', twoRoundsWithBreakAfterSecond);
    expect(next.status).toBe('reveal');
  });

  it('ends the quiz from reveal when the finished round was the last one', () => {
    const revealing: GameProgress = {
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
    };
    const next = getNextGameState(revealing, 'ADVANCE', twoRoundsWithBreakAfterSecond);
    expect(next.status).toBe('ended');
  });

  it('continues to the next round from reveal when more rounds remain', () => {
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
    };
    const next = getNextGameState(revealing, 'ADVANCE', threeRounds);
    expect(next).toEqual({
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: false,
    });
  });

  it('toggles the leaderboard on without changing the underlying status', () => {
    const locked: GameProgress = {
      status: 'locked',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
    };
    const next = getNextGameState(locked, 'TOGGLE_LEADERBOARD', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({ ...locked, isLeaderboardVisible: true });
  });

  it('toggles the leaderboard back off, resuming the prior status untouched', () => {
    const lockedWithLeaderboard: GameProgress = {
      status: 'locked',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: true,
    };
    const next = getNextGameState(lockedWithLeaderboard, 'TOGGLE_LEADERBOARD', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({ ...lockedWithLeaderboard, isLeaderboardVisible: false });
  });

  it('allows toggling the leaderboard even after the quiz has ended', () => {
    const ended: GameProgress = {
      status: 'ended',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
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
    };
    const next = getNextGameState(grading, 'END_QUIZ', twoRoundsWithBreakAfterSecond);
    expect(next.status).toBe('ended');
  });

  it('rejects locking answers when no question is open', () => {
    expect(() => getNextGameState(lobby, 'LOCK_ANSWERS', twoRoundsWithBreakAfterSecond)).toThrow(
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
    const ended: GameProgress = { status: 'ended', roundIndex: 1, questionIndex: 1, isLeaderboardVisible: false };
    expect(() => getNextGameState(ended, 'END_QUIZ', twoRoundsWithBreakAfterSecond)).toThrow(
      IllegalGameTransitionError,
    );
  });

  it('rejects advancing once the quiz has ended', () => {
    const ended: GameProgress = { status: 'ended', roundIndex: 1, questionIndex: 1, isLeaderboardVisible: false };
    expect(() => getNextGameState(ended, 'ADVANCE', twoRoundsWithBreakAfterSecond)).toThrow(
      IllegalGameTransitionError,
    );
  });

  it('rejects a config where the last round has no break (answers could never be revealed)', () => {
    const badContext: GameContext = {
      rounds: [{ questionCount: 1, breakAfter: false }],
    };
    const locked: GameProgress = { status: 'locked', roundIndex: 0, questionIndex: 0, isLeaderboardVisible: false };
    expect(() => getNextGameState(locked, 'ADVANCE', badContext)).toThrow(InvalidQuizConfigError);
  });
});
