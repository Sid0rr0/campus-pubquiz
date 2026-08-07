import { describe, expect, it } from 'vitest';
import {
  getBlockStartRoundIndex,
  getNextGameState,
  getQuizStructureSummary,
  isLastQuestionOfBreakAfterRound,
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
  furthestOpenIndex: 0,
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
      furthestOpenIndex: 0,
    });
  });

  it("shows round 0's intro card when advancing past the rules screen", () => {
    const rules: GameProgress = { ...lobby, status: 'rules' };
    const next = getNextGameState(rules, 'ADVANCE', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({
      status: 'round_intro',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    });
  });

  it('rejects moving back from the rules screen', () => {
    const rules: GameProgress = { ...lobby, status: 'rules' };
    expect(() => getNextGameState(rules, 'PREVIOUS', twoRoundsWithBreakAfterSecond)).toThrow(
      IllegalGameTransitionError,
    );
  });

  it('opens the first question of the round when advancing past its intro card', () => {
    const roundIntro: GameProgress = { ...lobby, status: 'round_intro' };
    const next = getNextGameState(roundIntro, 'ADVANCE', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    });
  });

  it('steps back from a round intro card to the rules screen for round 0', () => {
    const roundIntro: GameProgress = { ...lobby, status: 'round_intro' };
    const next = getNextGameState(roundIntro, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({
      status: 'rules',
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
    const next = getNextGameState(open, 'ADVANCE', twoRoundsWithBreakAfterSecond);
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
    const next = getNextGameState(open, 'ADVANCE', twoRoundsWithBreakAfterSecond);
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
    const next = getNextGameState(open, 'ADVANCE', twoRoundsWithBreakAfterSecond);
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
    const next = getNextGameState(locking, 'ADVANCE', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({ ...locking, status: 'break_intro', revealIndex: 3 }); // last of 4 questions in the 2-round block
  });

  it('reveals the specific just-locked question when Previous is pressed from break_intro, never decrementing past it', () => {
    const breakIntro: GameProgress = {
      status: 'break_intro',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 3,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(breakIntro, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({ ...breakIntro, status: 'break' });
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
    const next = getNextGameState(breakIntro, 'ADVANCE', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({ ...breakIntro, status: 'reveal_intro', revealIndex: 0 });
  });

  it('steps back from the locking countdown to the last question, unlocking it again', () => {
    const locking: GameProgress = {
      status: 'locking',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(locking, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({ ...locking, status: 'question_open' });
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
    const next = getNextGameState(grading, 'ADVANCE', twoRoundsWithBreakAfterSecond);
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
    const next = getNextGameState(revealIntro, 'ADVANCE', twoRoundsWithBreakAfterSecond);
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
    const next = getNextGameState(revealing, 'ADVANCE', twoRoundsWithBreakAfterSecond);
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
    const next = getNextGameState(revealing, 'ADVANCE', twoRoundsWithBreakAfterSecond);
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
    const next = getNextGameState(revealing, 'ADVANCE', twoRoundsWithBreakAfterSecond);
    expect(next.status).toBe('ended');
    expect(next.revealIndex).toBe(0);
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

  it('moves back to the previous reveal question within the same round', () => {
    const revealing: GameProgress = {
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 3, // round 1's second question within the 2-round block
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(revealing, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({ ...revealing, revealIndex: 2 });
  });

  it("steps back to a reveal round's own intro card when Previous is pressed at that round's first question", () => {
    const revealing: GameProgress = {
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 2, // round 1's first question within the 2-round block
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(revealing, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({ ...revealing, status: 'reveal_intro' });
  });

  it("steps back from a reveal round intro card to the previous round's last reveal question", () => {
    const revealIntro: GameProgress = {
      status: 'reveal_intro',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 2, // round 1's first question within the 2-round block
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(revealIntro, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({ ...revealIntro, status: 'reveal', revealIndex: 1 });
  });

  it("steps back from the block's first reveal round intro card into that same block's break, not straight into an earlier block", () => {
    const revealIntro: GameProgress = {
      status: 'reveal_intro',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(revealIntro, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    // Re-entering break restarts review at the block's last question, same
    // as locking->break does — the illegal-transition case (no earlier
    // block to cross into) only surfaces once Previous is pressed enough
    // more times from here to walk that review back to its own first
    // question; see "rejects moving back past a break with no earlier
    // block to review" below.
    expect(next).toEqual({ ...revealIntro, status: 'break', revealIndex: 3 }); // last of 4 questions in the 2-round block
  });

  it("crosses into the previous block's reveal once Previous walks a re-entered break review all the way back to its own first question", () => {
    const breakFirstThenTwo: GameContext = {
      rounds: [
        { questionCount: 1, breakAfter: true },
        { questionCount: 2, breakAfter: true },
      ],
    };
    const revealIntro: GameProgress = {
      status: 'reveal_intro',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0, // first question of the second block's reveal
      furthestOpenIndex: 0,
    };
    const backToBreak = getNextGameState(revealIntro, 'PREVIOUS', breakFirstThenTwo);
    expect(backToBreak).toEqual({ ...revealIntro, status: 'break', revealIndex: 1 }); // last of 2 questions in round 1's block

    const stepBack = getNextGameState(backToBreak, 'PREVIOUS', breakFirstThenTwo);
    expect(stepBack).toEqual({ ...backToBreak, revealIndex: 0 });

    // Round 1 is the block's only (and therefore first) round — Previous
    // pauses on its own title card before crossing any further back.
    const roundTitle = getNextGameState(stepBack, 'PREVIOUS', breakFirstThenTwo);
    expect(roundTitle).toEqual({ ...stepBack, status: 'break_round_intro' });

    const crossed = getNextGameState(roundTitle, 'PREVIOUS', breakFirstThenTwo);
    expect(crossed).toEqual({
      status: 'reveal',
      roundIndex: 0,
      questionIndex: 0, // last (only) question of round 0
      isLeaderboardVisible: false,
      revealIndex: 0, // last (only) reveal question of round 0's block
      furthestOpenIndex: 0,
    });
  });

  it('steps back from the very first reveal question of a block to its own round intro card', () => {
    const revealing: GameProgress = {
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(revealing, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({ ...revealing, status: 'reveal_intro' });
  });

  it('toggles the leaderboard on without changing the underlying status', () => {
    const open: GameProgress = {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
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
      furthestOpenIndex: 0,
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
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(ended, 'TOGGLE_LEADERBOARD', twoRoundsWithBreakAfterSecond);
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
      getNextGameState(openWithoutLeaderboard, 'REVEAL_NEXT_TEAM', twoRoundsWithBreakAfterSecond),
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

  it('rejects ending a quiz that has already ended', () => {
    const ended: GameProgress = {
      status: 'ended',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
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
      furthestOpenIndex: 0,
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
      furthestOpenIndex: 0,
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
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(open, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    });
  });

  it("moves back to round 1's intro card from its first question, not straight into round 0", () => {
    const open: GameProgress = {
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0, // first question of round 1, still the same open block as round 0
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(open, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({
      status: 'round_intro',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    });
  });

  it("steps back from round 1's intro card to round 0's last question when round 0 had no break", () => {
    const roundIntro: GameProgress = {
      status: 'round_intro',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(roundIntro, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1, // last question of round 0 (questionCount: 2)
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    });
  });

  it('moves back to round 0\'s intro card from its first question instead of rejecting', () => {
    const open: GameProgress = {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(open, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({
      status: 'round_intro',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    });
  });

  it("steps back from a new block's round intro card to the previous block's last reveal question, without reopening grading", () => {
    const breakFirstThenTwo: GameContext = {
      rounds: [
        { questionCount: 1, breakAfter: true },
        { questionCount: 2, breakAfter: true },
      ],
    };
    const roundIntro: GameProgress = {
      status: 'round_intro',
      roundIndex: 1, // a new block after round 0's break
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(roundIntro, 'PREVIOUS', breakFirstThenTwo);
    expect(next).toEqual({
      status: 'reveal',
      roundIndex: 0,
      questionIndex: 0, // last (only) question of round 0
      isLeaderboardVisible: false,
      revealIndex: 0, // last (only) reveal question of round 0's block
      furthestOpenIndex: 0,
    });
  });

  it('walks back through the just-locked block during a break, without leaving break status', () => {
    const grading: GameProgress = {
      status: 'break',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 3, // last of 4 questions in the 2-round block
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(grading, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({ ...grading, revealIndex: 2 });
  });

  it("pauses on round 1's title from a break's first question, then crosses into the previous block's reveal", () => {
    const breakFirstThenTwo: GameContext = {
      rounds: [
        { questionCount: 1, breakAfter: true },
        { questionCount: 2, breakAfter: true },
      ],
    };
    const grading: GameProgress = {
      status: 'break',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const roundTitle = getNextGameState(grading, 'PREVIOUS', breakFirstThenTwo);
    expect(roundTitle).toEqual({ ...grading, status: 'break_round_intro' });

    const crossed = getNextGameState(roundTitle, 'PREVIOUS', breakFirstThenTwo);
    expect(crossed).toEqual({
      status: 'reveal',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    });
  });

  it("pauses on round 1's title, the quiz's very first round, reachable purely by walking Previous", () => {
    const grading: GameProgress = {
      status: 'break',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(grading, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({ ...grading, status: 'break_round_intro' });
  });

  it('rejects moving back past round 1\'s title card with no earlier block to review', () => {
    const roundTitle: GameProgress = {
      status: 'break_round_intro',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    expect(() => getNextGameState(roundTitle, 'PREVIOUS', twoRoundsWithBreakAfterSecond)).toThrow(
      IllegalGameTransitionError,
    );
  });

  it('resumes into the paused question when Advance is pressed from a break round title card', () => {
    const roundTitle: GameProgress = {
      status: 'break_round_intro',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 2,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(roundTitle, 'ADVANCE', twoRoundsWithBreakAfterSecond);
    expect(next).toEqual({ ...roundTitle, status: 'break' });
  });

  it("carries furthestOpenIndex forward as ADVANCE opens questions, and doesn't shrink it when Previous walks back", () => {
    let progress = getNextGameState({ ...lobby, status: 'rules' }, 'ADVANCE', twoRoundsWithBreakAfterSecond); // round_intro(0,0)
    progress = getNextGameState(progress, 'ADVANCE', twoRoundsWithBreakAfterSecond); // question_open(0,0), furthest 0
    progress = getNextGameState(progress, 'ADVANCE', twoRoundsWithBreakAfterSecond); // question_open(0,1), furthest 1
    progress = getNextGameState(progress, 'ADVANCE', twoRoundsWithBreakAfterSecond); // round_intro(1,0), furthest still 1 (no break)
    progress = getNextGameState(progress, 'ADVANCE', twoRoundsWithBreakAfterSecond); // question_open(1,0), furthest 2
    progress = getNextGameState(progress, 'ADVANCE', twoRoundsWithBreakAfterSecond); // question_open(1,1), furthest 3

    const steppedBack = getNextGameState(progress, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(steppedBack).toMatchObject({
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0,
      furthestOpenIndex: 3, // unchanged — question (1,1) stays open even though the display stepped back off it
    });
  });

  it('resets furthestOpenIndex to -1 (nothing opened yet) once a new block starts after the previous block is fully revealed', () => {
    const twoSingleQuestionBlocks: GameContext = {
      rounds: [
        { questionCount: 1, breakAfter: true },
        { questionCount: 1, breakAfter: true },
      ],
    };
    let progress = getNextGameState({ ...lobby, status: 'rules' }, 'ADVANCE', twoSingleQuestionBlocks); // round_intro(0)
    progress = getNextGameState(progress, 'ADVANCE', twoSingleQuestionBlocks); // question_open(0,0), furthest 0
    progress = getNextGameState(progress, 'ADVANCE', twoSingleQuestionBlocks); // locking
    progress = getNextGameState(progress, 'ADVANCE', twoSingleQuestionBlocks); // break
    progress = getNextGameState(progress, 'ADVANCE', twoSingleQuestionBlocks); // reveal_intro (round 0)
    progress = getNextGameState(progress, 'ADVANCE', twoSingleQuestionBlocks); // reveal
    const nextBlockIntro = getNextGameState(progress, 'ADVANCE', twoSingleQuestionBlocks); // round_intro(1) — new block

    expect(nextBlockIntro).toMatchObject({
      status: 'round_intro',
      roundIndex: 1,
      furthestOpenIndex: -1,
    });
  });

  it("keeps furthestOpenIndex pointing at an already-opened question when Previous steps back into that round's intro card", () => {
    let progress = getNextGameState({ ...lobby, status: 'rules' }, 'ADVANCE', twoRoundsWithBreakAfterSecond); // round_intro(0,0)
    progress = getNextGameState(progress, 'ADVANCE', twoRoundsWithBreakAfterSecond); // question_open(0,0), furthest 0
    progress = getNextGameState(progress, 'ADVANCE', twoRoundsWithBreakAfterSecond); // question_open(0,1), furthest 1

    const backToFirstQuestion = getNextGameState(progress, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    expect(backToFirstQuestion).toMatchObject({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
    });
    const backToIntroCard = getNextGameState(backToFirstQuestion, 'PREVIOUS', twoRoundsWithBreakAfterSecond);
    // Distinguishable from a fresh round_intro (furthestOpenIndex -1): this
    // round's first question was genuinely opened, so it stays at least 0.
    expect(backToIntroCard).toMatchObject({
      status: 'round_intro',
      roundIndex: 0,
      furthestOpenIndex: 1,
    });
  });
});

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
    expect(isLastQuestionOfBreakAfterRound(progress, twoRoundsWithBreakAfterSecond)).toBe(true);
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
    expect(isLastQuestionOfBreakAfterRound(progress, twoRoundsWithBreakAfterSecond)).toBe(false);
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
    expect(isLastQuestionOfBreakAfterRound(progress, twoRoundsWithBreakAfterSecond)).toBe(false);
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
