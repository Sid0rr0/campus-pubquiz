import { describe, expect, it } from 'vitest';
import {
  getNextGameState,
  IllegalGameTransitionError,
  InvalidQuizConfigError,
  type GameContext,
  type GameProgress,
} from '../game-state';
import { lobby, twoRoundsWithBreakAfterSecond } from './game-state-fixtures';

describe('getNextGameState — leaderboard visibility and REVEAL_NEXT_TEAM', () => {
  it('toggles the leaderboard on without changing the underlying status', () => {
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
      'TOGGLE_LEADERBOARD',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({ ...open, isLeaderboardVisible: true });
  });

  it('toggles the leaderboard back off, resuming the prior status untouched', () => {
    const openWithLeaderboard: GameProgress = {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: true,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      openWithLeaderboard,
      'TOGGLE_LEADERBOARD',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({
      ...openWithLeaderboard,
      isLeaderboardVisible: false,
    });
  });

  it('allows toggling the leaderboard even after the quiz has ended', () => {
    const ended: GameProgress = {
      status: 'ended',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      ended,
      'TOGGLE_LEADERBOARD',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next.isLeaderboardVisible).toBe(true);
    expect(next.status).toBe('ended');
  });

  it('allows REVEAL_NEXT_TEAM without changing progress while the leaderboard is visible', () => {
    const openWithLeaderboard: GameProgress = {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: true,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      openWithLeaderboard,
      'REVEAL_NEXT_TEAM',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual(openWithLeaderboard);
  });

  it('rejects REVEAL_NEXT_TEAM while the leaderboard is hidden', () => {
    const openWithoutLeaderboard: GameProgress = {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    expect(() =>
      getNextGameState(
        openWithoutLeaderboard,
        'REVEAL_NEXT_TEAM',
        twoRoundsWithBreakAfterSecond,
      ),
    ).toThrow(IllegalGameTransitionError);
  });

  it('force-ends the quiz from any in-progress status', () => {
    const grading: GameProgress = {
      status: 'break',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      grading,
      'END_QUIZ',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next.status).toBe('ended');
  });

  it('shows the "Quiz complete!" screen, not the leaderboard, when the quiz ends', () => {
    const grading: GameProgress = {
      status: 'break',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      grading,
      'END_QUIZ',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next.isLeaderboardVisible).toBe(false);
  });

  it('hides an already-open leaderboard when the quiz ends', () => {
    const gradingWithLeaderboardOpen: GameProgress = {
      status: 'break',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: true,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      gradingWithLeaderboardOpen,
      'END_QUIZ',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next.isLeaderboardVisible).toBe(false);
  });
});

describe('getNextGameState — illegal transitions and config guards', () => {
  it('rejects advancing from the lobby', () => {
    expect(() =>
      getNextGameState(lobby, 'ADVANCE', twoRoundsWithBreakAfterSecond),
    ).toThrow(IllegalGameTransitionError);
  });

  it('rejects starting a quiz that is already open', () => {
    const open: GameProgress = { ...lobby, status: 'question_open' };
    expect(() =>
      getNextGameState(open, 'START_QUIZ', twoRoundsWithBreakAfterSecond),
    ).toThrow(IllegalGameTransitionError);
  });

  it('rejects ending a quiz that has already ended', () => {
    const ended: GameProgress = {
      status: 'ended',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    expect(() =>
      getNextGameState(ended, 'END_QUIZ', twoRoundsWithBreakAfterSecond),
    ).toThrow(IllegalGameTransitionError);
  });

  it('rejects advancing once the quiz has ended', () => {
    const ended: GameProgress = {
      status: 'ended',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    expect(() =>
      getNextGameState(ended, 'ADVANCE', twoRoundsWithBreakAfterSecond),
    ).toThrow(IllegalGameTransitionError);
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
      furthestOpenIndex: 0,
    };
    expect(() => getNextGameState(open, 'ADVANCE', badContext)).toThrow(
      InvalidQuizConfigError,
    );
  });
});
