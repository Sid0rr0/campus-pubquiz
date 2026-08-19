import { describe, expect, it } from 'vitest';
import {
  getNextGameState,
  IllegalGameTransitionError,
  type GameContext,
  type GameProgress,
} from '../game-state';
import { lobby, twoRoundsWithBreakAfterSecond } from './game-state-fixtures';

describe('getNextGameState — backward (PREVIOUS) transitions', () => {
  it('rejects moving back from the rules screen', () => {
    const rules: GameProgress = { ...lobby, status: 'rules' };
    expect(() =>
      getNextGameState(rules, 'PREVIOUS', twoRoundsWithBreakAfterSecond),
    ).toThrow(IllegalGameTransitionError);
  });

  it('steps back from a round intro card to the rules screen for round 0', () => {
    const roundIntro: GameProgress = { ...lobby, status: 'round_intro' };
    const next = getNextGameState(
      roundIntro,
      'PREVIOUS',
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

  it('reveals the specific just-locked question when Previous is pressed from break_intro, never decrementing past it', () => {
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
      'PREVIOUS',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({ ...breakIntro, status: 'break' });
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
    const next = getNextGameState(
      locking,
      'PREVIOUS',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({ ...locking, status: 'question_open' });
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
    const next = getNextGameState(
      revealing,
      'PREVIOUS',
      twoRoundsWithBreakAfterSecond,
    );
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
    const next = getNextGameState(
      revealing,
      'PREVIOUS',
      twoRoundsWithBreakAfterSecond,
    );
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
    const next = getNextGameState(
      revealIntro,
      'PREVIOUS',
      twoRoundsWithBreakAfterSecond,
    );
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
    const next = getNextGameState(
      revealIntro,
      'PREVIOUS',
      twoRoundsWithBreakAfterSecond,
    );
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
    const backToBreak = getNextGameState(
      revealIntro,
      'PREVIOUS',
      breakFirstThenTwo,
    );
    expect(backToBreak).toEqual({
      ...revealIntro,
      status: 'break',
      revealIndex: 1,
    }); // last of 2 questions in round 1's block

    const stepBack = getNextGameState(
      backToBreak,
      'PREVIOUS',
      breakFirstThenTwo,
    );
    expect(stepBack).toEqual({ ...backToBreak, revealIndex: 0 });

    // Round 1 is the block's only (and therefore first) round — Previous
    // pauses on its own title card before crossing any further back.
    const roundTitle = getNextGameState(
      stepBack,
      'PREVIOUS',
      breakFirstThenTwo,
    );
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
    const next = getNextGameState(
      revealing,
      'PREVIOUS',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({ ...revealing, status: 'reveal_intro' });
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
    const next = getNextGameState(
      open,
      'PREVIOUS',
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

  it("moves back to round 1's intro card from its first question, not straight into round 0", () => {
    const open: GameProgress = {
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0, // first question of round 1, still the same open block as round 0
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      open,
      'PREVIOUS',
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

  it("steps back from round 1's intro card to round 0's last question when round 0 had no break", () => {
    const roundIntro: GameProgress = {
      status: 'round_intro',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    const next = getNextGameState(
      roundIntro,
      'PREVIOUS',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1, // last question of round 0 (questionCount: 2)
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    });
  });

  it("moves back to round 0's intro card from its first question instead of rejecting", () => {
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
      'PREVIOUS',
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
    const next = getNextGameState(
      grading,
      'PREVIOUS',
      twoRoundsWithBreakAfterSecond,
    );
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
    const next = getNextGameState(
      grading,
      'PREVIOUS',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({ ...grading, status: 'break_round_intro' });
  });

  it("rejects moving back past round 1's title card with no earlier block to review", () => {
    const roundTitle: GameProgress = {
      status: 'break_round_intro',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    };
    expect(() =>
      getNextGameState(roundTitle, 'PREVIOUS', twoRoundsWithBreakAfterSecond),
    ).toThrow(IllegalGameTransitionError);
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
    const next = getNextGameState(
      roundTitle,
      'ADVANCE',
      twoRoundsWithBreakAfterSecond,
    );
    expect(next).toEqual({ ...roundTitle, status: 'break' });
  });
});
