import { describe, expect, it } from 'vitest';
import { IllegalGameTransitionError, type GameProgress } from '../game-state';
import {
  describeAdvanceStep,
  describePreviousState,
  effectiveActionOf,
  planMove,
  planNextPress,
} from '../move-plan';
import type { ClosestGuessRevealData } from '../question-views';
import type { ActiveShowdownRoundState, SessionState } from '../session-state';
import {
  closestGuessQuestion,
  freeTextQuestion,
  leaderboardEntry,
  round,
  sessionWith,
} from './session-fixtures';

const YOUTUBE = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const AUDIO_FILE = 'https://example.com/song.mp3';
const IMAGE = 'https://example.com/photo.png';

const BLOCK = [round(1, [10, 11])];

/** A session standing on the last question of a one-round block, in `status`. */
function inBlock(
  status: GameProgress['status'],
  progress: Partial<GameProgress> = {},
  overrides: Partial<SessionState> = {},
): SessionState {
  return sessionWith(
    BLOCK,
    {
      status,
      roundIndex: 0,
      questionIndex: 1,
      furthestOpenIndex: 1,
      revealIndex: 1,
      ...progress,
    },
    overrides,
  );
}

/** The question on air carries `mediaUrl`, so the big screen plays it. */
function playing(mediaUrl: string | undefined): SessionState {
  return sessionWith(
    [
      round(1, [10], {
        questions: [{ ...freeTextQuestion(10), mediaUrl }],
      }),
    ],
    { status: 'question_open' },
  );
}

const teams = [
  leaderboardEntry(1, 'A', 30),
  leaderboardEntry(2, 'B', 20),
  leaderboardEntry(3, 'C', 10),
];

const SUMMARY: ClosestGuessRevealData = {
  hasSubmissions: true,
  minGuess: '10',
  maxGuess: '90',
  closestGuesses: [{ teamName: 'Team A', value: '50' }],
};

/** A closest_guess question on its reveal, five steps long, standing on `revealStep`. */
function closestGuessReveal(revealStep: number): SessionState {
  return sessionWith(
    [round(1, [10], { questions: [closestGuessQuestion(10)] })],
    { status: 'reveal', questionIndex: 0, furthestOpenIndex: 0 },
    { revealStep, closestGuessSummaries: { 10: SUMMARY } },
  );
}

/** A showdown of two seated teams on the ended screen, standing on `revealStep`. */
function showdown(
  revealStep: number,
  guesses: [string | null, string | null] = ['4', '6'],
): SessionState {
  const round: ActiveShowdownRoundState = {
    id: 1,
    question: 'How many?',
    answer: '5',
    participants: [
      { teamId: 1, teamName: 'A', seatIndex: 0, guess: guesses[0] },
      { teamId: 2, teamName: 'B', seatIndex: 1, guess: guesses[1] },
    ],
    winnerTeamId: null,
    isTie: false,
    resolved: false,
  };
  return inBlock(
    'ended',
    {},
    {
      activeShowdownRound: round,
      revealStep,
    },
  );
}

describe('planMove', () => {
  describe('actions other than ADVANCE and PREVIOUS', () => {
    it('are plain transitions, even under the join overlay', () => {
      const session = inBlock('question_open', { isJoinOverlayVisible: true });

      const step = planMove(session, 'TOGGLE_LEADERBOARD');

      expect(step).toMatchObject({ kind: 'transition' });
      expect(step.kind === 'transition' && step.progress).toMatchObject({
        isLeaderboardVisible: true,
      });
    });

    it('are blocked when the state machine refuses them', () => {
      const step = planMove(inBlock('question_open'), 'START_QUIZ');

      expect(step.kind).toBe('blocked');
    });
  });

  describe('media actions', () => {
    it.each([
      ['REPLAY_MEDIA', YOUTUBE, 'transition'],
      ['REPLAY_MEDIA', AUDIO_FILE, 'blocked'],
      ['REPLAY_MEDIA', IMAGE, 'blocked'],
      ['REPLAY_MEDIA', undefined, 'blocked'],
      ['TOGGLE_MEDIA_PAUSE', YOUTUBE, 'transition'],
      ['TOGGLE_MEDIA_PAUSE', AUDIO_FILE, 'transition'],
      ['TOGGLE_MEDIA_PAUSE', IMAGE, 'blocked'],
      ['TOGGLE_MEDIA_PAUSE', undefined, 'blocked'],
    ] as const)('%s with media %s is %s', (action, mediaUrl, expected) => {
      expect(planMove(playing(mediaUrl), action).kind).toBe(expected);
    });

    it('refuses with the state machine’s own illegal-transition error', () => {
      const step = planMove(playing(IMAGE), 'REPLAY_MEDIA');

      expect(step.kind === 'blocked' && step.cause).toBeInstanceOf(
        IllegalGameTransitionError,
      );
    });

    it('never gates an action that is not about media', () => {
      expect(planMove(playing(undefined), 'END_QUIZ').kind).toBe('transition');
    });
  });

  describe('under the join overlay', () => {
    it.each(['ADVANCE', 'PREVIOUS'] as const)(
      '%s only hides it',
      (movement) => {
        const session = inBlock('question_open', {
          isJoinOverlayVisible: true,
        });

        const step = planMove(session, movement);

        expect(step.kind).toBe('join_overlay_hide');
        expect(
          step.kind === 'join_overlay_hide' && step.progress,
        ).toMatchObject({
          isJoinOverlayVisible: false,
          status: 'question_open',
        });
      },
    );
  });

  describe('under the leaderboard', () => {
    const covered = (
      status: GameProgress['status'],
      revealCount: number,
      overrides: Partial<SessionState> = {},
    ) =>
      inBlock(
        status,
        { isLeaderboardVisible: true },
        {
          leaderboard: teams,
          leaderboardRevealCount: revealCount,
          ...overrides,
        },
      );

    it('shows the next rank on ADVANCE while ranks are hidden', () => {
      expect(planMove(covered('break_intro', 1), 'ADVANCE')).toMatchObject({
        kind: 'leaderboard_reveal',
        place: 2,
        placeCount: 3,
      });
    });

    it('refuses PREVIOUS with the state machine’s illegal-transition error', () => {
      const step = planMove(covered('break_intro', 0), 'PREVIOUS');

      expect(step.kind).toBe('blocked');
      expect(step.kind === 'blocked' && step.cause).toBeInstanceOf(
        IllegalGameTransitionError,
      );
    });

    it('hides the board on ADVANCE once every rank is shown', () => {
      const step = planMove(covered('break_intro', 3), 'ADVANCE');

      expect(step.kind).toBe('leaderboard_hide');
      expect(step.kind === 'leaderboard_hide' && step.progress).toMatchObject({
        isLeaderboardVisible: false,
        status: 'break_intro',
      });
    });

    it('does not offer to hide the board when nothing can advance underneath', () => {
      expect(planMove(covered('ended', 3), 'ADVANCE').kind).toBe('blocked');
    });

    it('counts a kahoot round’s reveal steps over its capped board', () => {
      const many = Array.from({ length: 7 }, (_, index) =>
        leaderboardEntry(index + 1, `T${index + 1}`, 70 - index),
      );
      const kahoot = sessionWith(
        [round(1, [10, 11], { kahootMode: true })],
        { status: 'question_open', isLeaderboardVisible: true },
        { leaderboard: many, leaderboardRevealCount: 0 },
      );
      const normal = sessionWith(
        BLOCK,
        { status: 'question_open', isLeaderboardVisible: true },
        { leaderboard: many, leaderboardRevealCount: 0 },
      );

      expect(planMove(kahoot, 'ADVANCE')).toMatchObject({ placeCount: 5 });
      expect(planMove(normal, 'ADVANCE')).toMatchObject({ placeCount: 7 });
    });

    it('counts the steps even when the session stands in no round', () => {
      const session = sessionWith(
        [],
        { isLeaderboardVisible: true },
        { leaderboard: teams, leaderboardRevealCount: 0 },
      );

      expect(planMove(session, 'ADVANCE')).toMatchObject({
        kind: 'leaderboard_reveal',
        placeCount: 3,
      });
    });
  });

  describe('the stepped reveal on air', () => {
    it('steps a closest_guess reveal on ADVANCE, pressable, final on its last step', () => {
      expect(planMove(closestGuessReveal(0), 'ADVANCE')).toMatchObject({
        kind: 'reveal_step',
        reveal: 'closest_guess',
        isFinal: false,
        isPressable: true,
      });
      expect(planMove(closestGuessReveal(3), 'ADVANCE')).toMatchObject({
        kind: 'reveal_step',
        isFinal: true,
        isPressable: true,
      });
    });

    it('carries the stepped session', () => {
      const step = planMove(closestGuessReveal(1), 'PREVIOUS');

      expect(step.kind === 'reveal_step' && step.session.revealStep).toBe(0);
    });

    it('falls through to the state machine past its last step', () => {
      expect(planMove(closestGuessReveal(4), 'ADVANCE').kind).toBe(
        'transition',
      );
    });

    it('holds a showdown at its last step: ADVANCE is a pressable repeat', () => {
      expect(planMove(showdown(3), 'ADVANCE')).toMatchObject({
        kind: 'reveal_step',
        reveal: 'showdown',
        isFinal: false,
        isPressable: true,
      });
    });

    it('holds a showdown at its first step: PREVIOUS has nowhere to go', () => {
      expect(planMove(showdown(0), 'PREVIOUS')).toMatchObject({
        kind: 'reveal_step',
        reveal: 'showdown',
        isFinal: false,
        isPressable: false,
      });
    });

    it('waits on a showdown still missing a guess', () => {
      expect(planMove(showdown(0, ['4', null]), 'ADVANCE')).toEqual({
        kind: 'showdown_waiting',
      });
    });

    it('steps a showdown whose seats have all guessed', () => {
      expect(planMove(showdown(0), 'ADVANCE')).toMatchObject({
        kind: 'reveal_step',
        reveal: 'showdown',
        isPressable: true,
      });
    });
  });

  describe('leaving the break into the reveal', () => {
    it.each(['break_intro', 'break'] as const)(
      'is refused from %s while answers wait for grading',
      (status) => {
        const session = inBlock(status, {}, { ungradedQuestionIds: [10, 11] });

        const step = planMove(session, 'ADVANCE');

        expect(step).toMatchObject({
          kind: 'grading_pending',
          ungradedQuestionIds: [10, 11],
        });
        expect(step.kind === 'grading_pending' && step.progress.status).toBe(
          'reveal_intro',
        );
      },
    );

    it('goes through once nothing is ungraded', () => {
      const step = planMove(inBlock('break'), 'ADVANCE');

      expect(step.kind === 'transition' && step.progress.status).toBe(
        'reveal_intro',
      );
    });

    it('is not gated while browsing the break', () => {
      const session = sessionWith(
        BLOCK,
        {
          status: 'break',
          questionIndex: 1,
          furthestOpenIndex: 1,
          revealIndex: 0,
        },
        { ungradedQuestionIds: [10] },
      );

      expect(planMove(session, 'ADVANCE').kind).toBe('transition');
    });

    it('is not gated on a round change inside the reveal', () => {
      const session = sessionWith(
        [round(1, [10], { breakAfter: false }), round(2, [20])],
        {
          status: 'reveal',
          roundIndex: 1,
          questionIndex: 0,
          furthestOpenIndex: 1,
          revealIndex: 0,
        },
        { ungradedQuestionIds: [10] },
      );

      const step = planMove(session, 'ADVANCE');

      expect(step.kind === 'transition' && step.progress.status).toBe(
        'reveal_intro',
      );
    });

    it('is never gated going back', () => {
      const session = inBlock('break_intro', {}, { ungradedQuestionIds: [10] });

      expect(planMove(session, 'PREVIOUS').kind).toBe('transition');
    });
  });
});

describe('planNextPress', () => {
  it('starts the quiz from the lobby', () => {
    const step = planNextPress(sessionWith(BLOCK));

    expect(step.kind === 'transition' && step.progress.status).toBe('rules');
  });

  it('drives the board from the lobby when the leaderboard covers it', () => {
    const session = sessionWith(
      BLOCK,
      { isLeaderboardVisible: true },
      { leaderboard: teams, leaderboardRevealCount: 0 },
    );

    expect(planNextPress(session).kind).toBe('leaderboard_reveal');
  });

  it('advances everywhere else', () => {
    const step = planNextPress(inBlock('question_open'));

    expect(step.kind === 'transition' && step.progress.status).toBe('locking');
  });
});

describe('effectiveActionOf', () => {
  it('names the toggle a hide step is carried out as', () => {
    const progress = sessionWith(BLOCK).progress;

    expect(
      effectiveActionOf({ kind: 'join_overlay_hide', progress }, 'ADVANCE'),
    ).toBe('TOGGLE_JOIN_OVERLAY');
    expect(
      effectiveActionOf({ kind: 'leaderboard_hide', progress }, 'ADVANCE'),
    ).toBe('TOGGLE_LEADERBOARD');
  });

  it('keeps the pressed action for any other step', () => {
    const progress = sessionWith(BLOCK).progress;

    expect(effectiveActionOf({ kind: 'transition', progress }, 'ADVANCE')).toBe(
      'ADVANCE',
    );
  });
});

describe('describeAdvanceStep', () => {
  it.each([
    [
      'reveals the next rank under the leaderboard',
      () =>
        inBlock(
          'break_intro',
          { isLeaderboardVisible: true },
          { leaderboard: teams, leaderboardRevealCount: 0 },
        ),
      'reveal_next_rank',
    ],
    [
      'hides the leaderboard once every rank is shown',
      () =>
        inBlock(
          'break_intro',
          { isLeaderboardVisible: true },
          { leaderboard: teams, leaderboardRevealCount: 3 },
        ),
      'hide_leaderboard',
    ],
    [
      'hides the join overlay',
      () => inBlock('question_open', { isJoinOverlayVisible: true }),
      'hide_join_overlay',
    ],
    ['advances a plain transition', () => inBlock('question_open'), 'advance'],
    ['advances a reveal step', () => closestGuessReveal(0), 'advance'],
    ['advances a held showdown', () => showdown(3), 'advance'],
    [
      'advances a showdown waiting for guesses',
      () => showdown(0, ['4', null]),
      'advance',
    ],
    [
      'advances into the grading gate',
      () => inBlock('break', {}, { ungradedQuestionIds: [10] }),
      'advance',
    ],
    ['is none when the state machine refuses', () => inBlock('ended'), 'none'],
  ] as const)('%s', (_name, build, expected) => {
    expect(describeAdvanceStep(build())).toBe(expected);
  });
});

describe('describePreviousState', () => {
  it('is available under the join overlay, whatever is underneath', () => {
    expect(
      describePreviousState(sessionWith(BLOCK, { isJoinOverlayVisible: true })),
    ).toBe('available');
  });

  it('is unavailable where Previous has nowhere to go', () => {
    expect(describePreviousState(sessionWith(BLOCK))).toBe('unavailable');
  });

  it('is unavailable on a reveal held at its start', () => {
    expect(describePreviousState(showdown(0))).toBe('unavailable');
  });

  it('is available when the quiz can step back', () => {
    expect(describePreviousState(inBlock('question_open'))).toBe('available');
  });

  it('is covered by the leaderboard when it could step back underneath', () => {
    const session = inBlock('question_open', { isLeaderboardVisible: true });

    expect(describePreviousState(session)).toBe('covered_by_leaderboard');
  });

  it('is unavailable under the leaderboard when nothing can step back underneath', () => {
    const session = sessionWith(BLOCK, { isLeaderboardVisible: true });

    expect(describePreviousState(session)).toBe('unavailable');
  });
});
