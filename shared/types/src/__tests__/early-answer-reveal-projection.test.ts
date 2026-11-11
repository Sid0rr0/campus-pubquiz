import { describe, expect, it } from 'vitest';
import type { GameProgress } from '../game-state';
import { projectScreen } from '../screen-projection';
import type { SessionState } from '../session-state';
import { SOCKET_ROOMS } from '../socket-events';
import {
  closestGuessQuestion,
  round,
  sessionWith,
  SUMMARY,
} from './session-fixtures';

const rounds = [round(1, [10, 11], { title: 'Alpha' })];

function at(
  status: GameProgress['status'],
  revealIndex: number,
  overrides: Partial<SessionState> = {},
  seeded = rounds,
): SessionState {
  return sessionWith(
    seeded,
    {
      status,
      roundIndex: 0,
      questionIndex: 1,
      furthestOpenIndex: 1,
      revealIndex,
    },
    overrides,
  );
}

describe('Early answer reveal — the display on answers', () => {
  it('draws the round title card on answers_intro', () => {
    const { screen } = projectScreen(
      at('answers_intro', 0),
      SOCKET_ROOMS.DISPLAY,
    );
    expect(screen).toEqual({
      kind: 'answers_intro',
      roundNumber: 1,
      title: 'Alpha',
    });
  });

  it('draws the question with its answer on answers', () => {
    const view = projectScreen(at('answers', 1), SOCKET_ROOMS.DISPLAY);
    expect(view.screen).toMatchObject({
      kind: 'answers',
      question: { id: 11, answer: 'Answer 11' },
      notes: '',
    });
    expect(view.header.badge).toBe('ANSWERS · QUESTION 2');
  });

  it('carries the power-up use counts but no correct-rate figures', () => {
    const session = at('answers', 0, {
      funFactData: {
        answers: [],
        bonusAwards: [],
        powerUps: [{ powerUp: 'fifty_fifty', questionId: 10 }],
      } as unknown as SessionState['funFactData'],
    });
    const answers = projectScreen(session, SOCKET_ROOMS.DISPLAY);
    expect(answers.powerUpCounts).toEqual([
      { powerUp: 'fifty_fifty', count: 1 },
    ]);
    expect(answers.teamsCorrect).toBeNull();

    const reveal = projectScreen(
      { ...session, progress: { ...session.progress, status: 'reveal' } },
      SOCKET_ROOMS.DISPLAY,
    );
    expect(reveal.teamsCorrect).not.toBeNull();
  });

  it('walks a closest_guess question through its steps', () => {
    const session = sessionWith(
      [round(1, [], { questions: [closestGuessQuestion(20)] })],
      {
        status: 'answers',
        questionIndex: 0,
        furthestOpenIndex: 0,
        revealIndex: 0,
      },
      { closestGuessSummaries: { 20: SUMMARY }, revealStep: 0 },
    );
    const screenAt = (revealStep: number) =>
      projectScreen({ ...session, revealStep }, SOCKET_ROOMS.DISPLAY).screen;

    expect(screenAt(0)).toMatchObject({
      kind: 'answers',
      question: { revealKind: 'closest_guess_pending' },
    });
    expect(screenAt(99)).toMatchObject({
      kind: 'answers',
      question: { revealKind: 'closest_guess', answer: '55' },
    });
  });
});

describe('Early answer reveal — the phone under the post-break leaderboard', () => {
  const twoBlocks = [
    round(1, [10, 11], { title: 'Alpha' }),
    round(2, [20], { title: 'Beta' }),
  ];

  function afterBreak(
    progress: Partial<GameProgress>,
    isEarly = true,
  ): SessionState {
    const session = sessionWith(twoBlocks, {
      status: 'round_intro',
      roundIndex: 1,
      questionIndex: 0,
      furthestOpenIndex: -1,
      isLeaderboardVisible: true,
      ...progress,
    });
    return {
      ...session,
      seededGame: {
        ...session.seededGame,
        settings: {
          ...session.seededGame.settings,
          earlyAnswerReveal: isEarly,
        },
      },
    };
  }

  it('shows the graded block in revealing mode instead of the leaderboard', () => {
    const view = projectScreen(afterBreak({}), SOCKET_ROOMS.PLAYERS);
    expect(view.phoneScreen).toEqual({
      kind: 'block',
      mode: 'revealing',
      onScreenQuestionId: 10,
    });
    expect(view.blockQuestions.map(({ id }) => id)).toEqual([10, 11]);
    expect(view.revealQuestions.map(({ id }) => id)).toEqual([10, 11]);
  });

  it('shows the last block after the quiz ended from its break', () => {
    const view = projectScreen(
      afterBreak({
        status: 'ended',
        previousStatus: 'break_intro',
        roundIndex: 1,
        questionIndex: 0,
      }),
      SOCKET_ROOMS.PLAYERS,
    );
    expect(view.phoneScreen).toMatchObject({
      kind: 'block',
      mode: 'revealing',
    });
    expect(view.revealQuestions.map(({ id }) => id)).toEqual([20]);
  });

  it('is the usual phone screen once the board is hidden, or with the setting off', () => {
    expect(
      projectScreen(
        afterBreak({ isLeaderboardVisible: false }),
        SOCKET_ROOMS.PLAYERS,
      ).phoneScreen.kind,
    ).toBe('round_title');
    expect(
      projectScreen(afterBreak({}, false), SOCKET_ROOMS.PLAYERS).phoneScreen,
    ).toEqual({ kind: 'leaderboard' });
  });
});

describe('Early answer reveal — the phone on answers', () => {
  it('shows the block browser in answers mode following the question on air', () => {
    const view = projectScreen(at('answers', 1), SOCKET_ROOMS.PLAYERS);
    expect(view.phoneScreen).toEqual({
      kind: 'block',
      mode: 'answers',
      onScreenQuestionId: 11,
    });
    expect(view.revealQuestions.map(({ id }) => id)).toEqual([10, 11]);
  });

  it('shows the round title on answers_intro, like reveal_intro', () => {
    const view = projectScreen(at('answers_intro', 0), SOCKET_ROOMS.PLAYERS);
    expect(view.phoneScreen).toEqual({
      kind: 'round_title',
      title: 'Alpha',
      roundNumber: 1,
    });
  });
});
