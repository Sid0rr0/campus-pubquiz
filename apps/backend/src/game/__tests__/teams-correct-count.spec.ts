import { Logger } from '@nestjs/common';
import type { GameAction } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const MATCH_ROUND: QuizRoundSpec[] = [
  {
    title: 'Capitals',
    breakAfter: true,
    questions: [
      {
        type: 'match',
        prompt: 'Match countries to capitals',
        answer: 'Paris|Rome',
        points: 4,
        payload: {
          options: ['France', 'Italy'],
          matchTargets: ['Rome', 'Paris'],
        },
      },
    ],
  },
];

const CLOSEST_GUESS_ROUND: QuizRoundSpec[] = [
  {
    title: 'Estimation',
    breakAfter: true,
    questions: [
      {
        type: 'closest_guess',
        prompt: 'How many jelly beans?',
        answer: '500',
        points: 3,
      },
    ],
  },
];

const TO_REVEAL: GameAction[] = [
  'ADVANCE', // -> locking
  'ADVANCE', // -> break_intro (grading runs here)
  'ADVANCE', // -> reveal_intro
  'ADVANCE', // -> reveal
];

describe('Display view — teams-correct count on the reveal', () => {
  const harness = setupRealStoreGatewayTest();

  async function startAt(
    rounds: QuizRoundSpec[],
    answers: (string | null)[],
    beforeAnswers?: (game: RealStoreGateway) => void,
  ): Promise<RealStoreGateway> {
    const game = await harness.createGateway({
      rounds,
      teamNames: answers.map((_, index) => `Team ${index + 1}`),
    });
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
    await game.act('ADVANCE'); // -> q1
    beforeAnswers?.(game);
    for (const [index, value] of answers.entries()) {
      if (value === null) continue;
      const { socket, teamId } = game.teams[index];
      await game.gateway.handleSubmitAnswer(asSocket(socket), {
        questionId: game.rounds[0].questionIds[0],
        teamId,
        value,
      });
    }
    return game;
  }

  async function walk(game: RealStoreGateway, actions: GameAction[]) {
    for (const action of actions) {
      await game.act(action);
    }
  }

  it('counts correct and partial verdicts separately and totals every team, no-answers included', async () => {
    const game = await startAt(MATCH_ROUND, [
      'Paris|Rome', // correct
      'Paris|Paris', // one pair right: partial
      'Rome|Paris', // incorrect
      null, // no answer
    ]);

    await walk(game, TO_REVEAL);

    const display = await game.resync('display');
    expect(display.progress.status).toBe('reveal');
    expect(display.teamsCorrect).toEqual({
      correct: 1,
      partial: 1,
      teamCount: 4,
    });
  });

  it('keeps the earlier count while the leaderboard still updates when only the verdict tally read fails', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const game = await startAt(
      MATCH_ROUND,
      ['Paris|Rome', 'Rome|Paris'],
      (started) =>
        jest
          .spyOn(started.standingsService, 'verdictTallies')
          .mockRejectedValue(new Error('tallies unavailable')),
    );

    await walk(game, TO_REVEAL);

    const display = await game.resync('display');
    expect(display.progress.status).toBe('reveal');
    expect(display.teamsCorrect).toEqual({
      correct: 0,
      partial: 0,
      teamCount: 2,
    });
    expect(
      display.leaderboard.reduce((sum, entry) => sum + entry.totalPoints, 0),
    ).toBe(4);
  });

  it('has no count outside a revealed question', async () => {
    const game = await startAt(MATCH_ROUND, ['Paris|Rome']);

    const display = await game.resync('display');

    expect(display.teamsCorrect).toBeNull();
  });

  it('has no count on a closest_guess reveal', async () => {
    const game = await startAt(CLOSEST_GUESS_ROUND, ['480', '900']);

    await walk(game, TO_REVEAL);

    const display = await game.resync('display');
    expect(display.progress.status).toBe('reveal');
    expect(display.teamsCorrect).toBeNull();
  });

  it('is rebuilt from the stored verdicts after a backend restart', async () => {
    const game = await startAt(MATCH_ROUND, ['Paris|Rome', 'Paris|Rome']);

    await walk(game, TO_REVEAL);

    const live = (await game.resync('display')).teamsCorrect;
    const restarted = await game.restart();
    const resynced = (await restarted.resync('display')).teamsCorrect;
    expect(live).toEqual({ correct: 2, partial: 0, teamCount: 2 });
    expect(resynced).toEqual(live);
  });
});
