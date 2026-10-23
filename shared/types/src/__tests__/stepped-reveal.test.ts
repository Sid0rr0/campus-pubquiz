import { describe, expect, it } from 'vitest';
import { DEFAULT_SESSION_SETTINGS } from '../session-settings';
import {
  freshSessionState,
  LOBBY_PROGRESS,
  type ActiveShowdownRoundState,
} from '../session-state';
import type { GameAction, GameProgress } from '../game-state-types';
import type { SessionState } from '../session-state';
import { closestGuessQuestion, round, sessionWith } from './session-fixtures';
import {
  isFinalStep,
  revealOnAir,
  revealStartStep,
  revealStepAfterMove,
  revealStepOf,
  startStepOf,
  stepReveal,
  stepRevealOnAir,
  type SteppedRevealDescriptor,
} from '../stepped-reveal';

/** Three steps (0, 1, 2) that fall through at both ends and have no guard. */
const falling: SteppedRevealDescriptor = {
  stepCount: 3,
  atStart: 'fall_through',
  atEnd: 'fall_through',
  canStart: true,
};

const holding: SteppedRevealDescriptor = {
  ...falling,
  atStart: 'hold',
  atEnd: 'hold',
};

describe('stepReveal', () => {
  it('advances to the next step inside the bounds', () => {
    expect(stepReveal(falling, 0, 'ADVANCE')).toEqual({
      kind: 'step',
      step: 1,
      isFinal: false,
    });
  });

  it('flags the press that reaches the final step', () => {
    expect(stepReveal(falling, 1, 'ADVANCE')).toEqual({
      kind: 'step',
      step: 2,
      isFinal: true,
    });
  });

  it('goes back one step on Previous without flagging the final step', () => {
    expect(stepReveal(falling, 2, 'PREVIOUS')).toEqual({
      kind: 'step',
      step: 1,
      isFinal: false,
    });
  });

  it('falls through to the state machine past the last step when the reveal falls through', () => {
    expect(stepReveal(falling, 2, 'ADVANCE')).toEqual({ kind: 'fall_through' });
  });

  it('falls through before the first step when the reveal falls through', () => {
    expect(stepReveal(falling, 0, 'PREVIOUS')).toEqual({
      kind: 'fall_through',
    });
  });

  it('holds past the last step when the reveal holds', () => {
    expect(stepReveal(holding, 2, 'ADVANCE')).toEqual({ kind: 'hold' });
  });

  it('holds before the first step when the reveal holds', () => {
    expect(stepReveal(holding, 0, 'PREVIOUS')).toEqual({ kind: 'hold' });
  });

  it('holds at one end and falls through at the other when the descriptor says so', () => {
    const mixed = {
      ...falling,
      atStart: 'hold',
      atEnd: 'fall_through',
    } as const;
    expect(stepReveal(mixed, 0, 'PREVIOUS')).toEqual({ kind: 'hold' });
    expect(stepReveal(mixed, 2, 'ADVANCE')).toEqual({ kind: 'fall_through' });
  });

  it('waits on the first Advance while the guard refuses', () => {
    const guarded = { ...holding, canStart: false };
    expect(stepReveal(guarded, 0, 'ADVANCE')).toEqual({ kind: 'wait' });
  });

  it('lets the guard off once the reveal is past its first step', () => {
    const guarded = { ...holding, canStart: false };
    expect(stepReveal(guarded, 1, 'ADVANCE')).toEqual({
      kind: 'step',
      step: 2,
      isFinal: true,
    });
  });

  it('never waits on Previous', () => {
    const guarded = { ...holding, canStart: false };
    expect(stepReveal(guarded, 0, 'PREVIOUS')).toEqual({ kind: 'hold' });
  });

  it('treats a one-step reveal as final from the start, falling through on Advance', () => {
    const single = { ...falling, stepCount: 1 };
    expect(stepReveal(single, 0, 'ADVANCE')).toEqual({ kind: 'fall_through' });
    expect(isFinalStep(single, 0)).toBe(true);
  });
});

describe('startStepOf', () => {
  it('starts at step 0 when the reveal lands forward', () => {
    expect(startStepOf(falling, 'ADVANCE')).toBe(0);
    expect(startStepOf(falling, null)).toBe(0);
  });

  it('starts at the last step when the reveal lands on Previous', () => {
    expect(startStepOf(falling, 'PREVIOUS')).toBe(2);
  });
});

describe('reading a reveal step', () => {
  it('is 0 for a reveal that is not on air, whatever the counter holds', () => {
    const session = {
      ...freshSessionState({
        quizId: 1,
        gameSessionId: 1,
        joinCode: 'ABCDEF',
        rounds: [],
        settings: DEFAULT_SESSION_SETTINGS,
      }),
      revealStep: 3,
    };
    expect(revealOnAir(session)).toBeNull();
    expect(revealStepOf(session, 'closest_guess')).toBe(0);
    expect(revealStepOf(session, 'showdown')).toBe(0);
    expect(stepRevealOnAir(session, 'ADVANCE')).toEqual({ kind: 'none' });
  });

  describe('the showdown', () => {
    const round = (guesses: (string | null)[]): ActiveShowdownRoundState => ({
      id: 1,
      question: 'How many?',
      answer: '42',
      participants: guesses.map((guess, seatIndex) => ({
        teamId: seatIndex + 1,
        teamName: `Team ${seatIndex + 1}`,
        seatIndex,
        guess,
      })),
      winnerTeamId: null,
      isTie: false,
      resolved: false,
    });
    const ended = (guesses: (string | null)[], revealStep: number) => ({
      ...freshSessionState(
        {
          quizId: 1,
          gameSessionId: 1,
          joinCode: 'ABCDEF',
          rounds: [],
          settings: DEFAULT_SESSION_SETTINGS,
        },
        { ...LOBBY_PROGRESS, status: 'ended' as const },
      ),
      activeShowdownRound: round(guesses),
      revealStep,
    });

    it('is on air once the quiz has ended, with one step per seat plus a start and a final step', () => {
      expect(revealOnAir(ended(['1', '2'], 1))).toMatchObject({
        reveal: 'showdown',
        step: 1,
        descriptor: { stepCount: 4, atStart: 'hold', atEnd: 'hold' },
      });
      expect(revealStepOf(ended(['1', '2'], 1), 'showdown')).toBe(1);
      expect(revealStepOf(ended(['1', '2'], 1), 'closest_guess')).toBe(0);
    });

    it('is not on air before the quiz has ended, however the counter stands', () => {
      const session = {
        ...ended(['1', '2'], 2),
        progress: LOBBY_PROGRESS,
      };
      expect(revealOnAir(session)).toBeNull();
      expect(revealStepOf(session, 'showdown')).toBe(0);
    });

    it('waits on the first Advance while a seat has not guessed', () => {
      expect(stepRevealOnAir(ended(['1', null], 0), 'ADVANCE')).toEqual({
        kind: 'wait',
        reveal: 'showdown',
      });
    });

    it('reaches the final step on the Advance after the last seat and holds there', () => {
      expect(stepRevealOnAir(ended(['1', '2'], 2), 'ADVANCE')).toMatchObject({
        kind: 'step',
        reveal: 'showdown',
        isFinal: true,
      });
      expect(stepRevealOnAir(ended(['1', '2'], 3), 'ADVANCE')).toEqual({
        kind: 'hold',
        reveal: 'showdown',
      });
      expect(stepRevealOnAir(ended(['1', '2'], 0), 'PREVIOUS')).toEqual({
        kind: 'hold',
        reveal: 'showdown',
      });
    });
  });
});

describe('a closest_guess reveal on air', () => {
  const guessed = { hasSubmissions: true, closestGuesses: [] };
  // Round 0 has no break after it, so rounds 0 and 1 are one block of q1-q3.
  const rounds = [
    {
      ...round(1, [1, 2], { breakAfter: false }),
      questions: [closestGuessQuestion(1), closestGuessQuestion(2)],
    },
    { ...round(2, [3]), questions: [closestGuessQuestion(3)] },
  ];
  const at = (
    roundIndex: number,
    questionIndex: number,
    revealIndex: number,
    status: GameProgress['status'] = 'reveal',
  ): Partial<GameProgress> => ({
    status,
    roundIndex,
    questionIndex,
    revealIndex,
    furthestOpenIndex: 2,
  });
  const session = (
    progress: Partial<GameProgress>,
    overrides: Partial<SessionState> = {},
  ) =>
    sessionWith(rounds, progress, {
      closestGuessSummaries: { 1: guessed, 2: guessed, 3: guessed },
      revealStep: 2,
      ...overrides,
    });
  const LAST_STEP = 4;

  it('is on air at the reveal with the counter as its step', () => {
    expect(revealOnAir(session(at(1, 0, 0)))).toMatchObject({
      reveal: 'closest_guess',
      step: 2,
      descriptor: { stepCount: 5, atStart: 'fall_through' },
    });
    expect(revealStepOf(session(at(1, 0, 0)), 'closest_guess')).toBe(2);
    expect(revealStepOf(session(at(1, 0, 0)), 'showdown')).toBe(0);
  });

  it('is not on air when the quiz has ended with no showdown and no reveal', () => {
    expect(revealOnAir(session(at(1, 0, 0, 'ended')))).toBeNull();
  });

  it('steps forward through the session with its new counter', () => {
    const move = stepRevealOnAir(session(at(1, 0, 0)), 'ADVANCE');
    expect(move).toMatchObject({
      kind: 'step',
      reveal: 'closest_guess',
      isFinal: false,
    });
    expect((move as { session: SessionState }).session.revealStep).toBe(3);
    expect(stepRevealOnAir(session(at(1, 0, 0)), 'PREVIOUS')).toMatchObject({
      kind: 'step',
      isFinal: false,
    });
    expect(
      stepRevealOnAir(
        session(at(1, 0, 0), { revealStep: LAST_STEP }),
        'ADVANCE',
      ),
    ).toEqual({ kind: 'fall_through', reveal: 'closest_guess' });
  });

  describe('where a move starts the reveal', () => {
    it('starts at step 0 landing forward and at the last step landing on Previous', () => {
      expect(
        revealStartStep(
          session(at(1, 0, 0)),
          at(1, 0, 1) as GameProgress,
          'ADVANCE',
        ),
      ).toBe(0);
      expect(
        revealStartStep(
          session(at(1, 0, 0)),
          at(1, 0, 1) as GameProgress,
          'PREVIOUS',
        ),
      ).toBe(LAST_STEP);
    });

    it('is 0 when nothing is on air', () => {
      expect(
        revealStartStep(
          session(at(1, 0, 0)),
          at(1, 0, 0, 'break') as GameProgress,
          'PREVIOUS',
        ),
      ).toBe(0);
    });

    it('starts the showdown on its last step landing on Previous once the quiz has ended', () => {
      const showdown = {
        id: 1,
        question: 'Q',
        answer: '1',
        participants: [
          { teamId: 1, teamName: 'A', seatIndex: 0, guess: '1' },
          { teamId: 2, teamName: 'B', seatIndex: 1, guess: '2' },
        ],
        winnerTeamId: null,
        isTie: false,
        resolved: false,
      };
      const ended = session(at(1, 0, 0, 'ended'), {
        activeShowdownRound: showdown,
      });
      expect(revealStartStep(ended, ended.progress, 'PREVIOUS')).toBe(3);
      expect(revealStartStep(ended, ended.progress, 'ADVANCE')).toBe(0);
      // The showdown composed early does not take over a block still on reveal.
      const early = session(at(1, 0, 0), { activeShowdownRound: showdown });
      expect(revealOnAir(early)?.reveal).toBe('closest_guess');
    });
  });

  describe('the step a move settles on', () => {
    const next = (progress: Partial<GameProgress>, action: GameAction | null) =>
      revealStepAfterMove(
        session(at(1, 0, 0)),
        { ...at(1, 0, 0), ...progress } as GameProgress,
        action,
      );

    it('keeps the step while the same reveal stays on air', () => {
      expect(next({}, 'TOGGLE_LEADERBOARD')).toBe(2);
      expect(next({ isLeaderboardVisible: true }, 'PREVIOUS')).toBe(2);
    });

    it('restarts when placing, whatever stays on air', () => {
      expect(next({}, null)).toBe(0);
    });

    it('restarts on another reveal index, landing by the action', () => {
      expect(next({ revealIndex: 1 }, 'ADVANCE')).toBe(0);
      expect(next({ revealIndex: 1 }, 'PREVIOUS')).toBe(LAST_STEP);
    });

    it('restarts on another round of the block', () => {
      expect(next({ roundIndex: 0, questionIndex: 1 }, 'PREVIOUS')).toBe(
        LAST_STEP,
      );
      expect(next({ roundIndex: 0 }, 'PREVIOUS')).toBe(LAST_STEP);
    });

    it('restarts when the quiz has ended under a reveal', () => {
      expect(next({ status: 'ended' }, 'PREVIOUS')).toBe(0);
    });

    it('restarts on another question index of the same round', () => {
      const current = session(at(0, 1, 0));
      expect(
        revealStepAfterMove(current, at(0, 0, 0) as GameProgress, 'PREVIOUS'),
      ).toBe(LAST_STEP);
    });

    it('restarts when the status changes', () => {
      const current = session(at(1, 0, 0, 'break'));
      expect(
        revealStepAfterMove(current, at(1, 0, 0) as GameProgress, 'PREVIOUS'),
      ).toBe(LAST_STEP);
      expect(next({ status: 'break' }, 'PREVIOUS')).toBe(0);
    });

    it('keeps the step across the ended screen the showdown stands on', () => {
      const ended = session(at(1, 0, 0, 'ended'));
      expect(
        revealStepAfterMove(
          ended,
          at(1, 0, 0, 'ended') as GameProgress,
          'ADVANCE',
        ),
      ).toBe(2);
      expect(
        revealStepAfterMove(ended, at(1, 0, 0, 'ended') as GameProgress, null),
      ).toBe(0);
      expect(
        revealStepAfterMove(ended, at(1, 0, 0) as GameProgress, 'PREVIOUS'),
      ).toBe(LAST_STEP);
    });
  });
});

describe('isFinalStep', () => {
  it('is true only on the last step', () => {
    expect(isFinalStep(falling, 1)).toBe(false);
    expect(isFinalStep(falling, 2)).toBe(true);
  });
});
