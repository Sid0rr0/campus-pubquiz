import { asSocket } from '@/game/__tests__/test-utils';
import {
  advanceToBlockBoard,
  advanceUntil,
  setupRealStoreGatewayTest,
  submitAnswers,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const THREE_ROUNDS: QuizRoundSpec[] = [1, 2, 3].map((number) => ({
  title: `Round ${number}`,
  breakAfter: true,
  questions: [
    {
      type: 'multiple_choice' as const,
      prompt: `Question of round ${number}?`,
      answer: 'right',
      points: 1,
      payload: { options: ['right', 'wrong'] },
    },
  ],
}));

describe('GameGateway — joker scoring on the live totals', () => {
  const harness = setupRealStoreGatewayTest();

  /**
   * Bravo bets on round 2, Alpha on the rounds (by index) in `alphaPicks`, the
   * last one counting; both answer round 1 right; the board after round 1 is up.
   */
  async function playRoundOne(alphaPicks = [0]): Promise<RealStoreGateway> {
    const game = await harness.createGateway({
      rounds: THREE_ROUNDS,
      teamNames: ['Alpha', 'Bravo'],
      settings: { showRoundOverview: true, jokersEnabled: true },
    });
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_overview
    await game.act('ADVANCE'); // -> joker_pick
    const [alpha, bravo] = game.teams;
    for (const roundIndex of alphaPicks) {
      await game.gateway.handlePickJoker(asSocket(alpha.socket), {
        roundId: game.rounds[roundIndex].id,
      });
    }
    await game.gateway.handlePickJoker(asSocket(bravo.socket), {
      roundId: game.rounds[1].id,
    });
    await advanceUntil(game, 'question_open');
    await submitAnswers(game, ['right', 'right']);
    await advanceToBlockBoard(game);
    return game;
  }

  async function totals(game: RealStoreGateway) {
    const { leaderboard } = await game.snapshot();
    return Object.fromEntries(
      leaderboard.map((row) => [row.teamName, row.totalPoints]),
    );
  }

  it('doubles the joker round for the team that bet on it and marks its round cell', async () => {
    const game = await playRoundOne();

    const { leaderboard } = await game.snapshot();

    expect(await totals(game)).toEqual({ Alpha: 2, Bravo: 1 });
    const alpha = leaderboard.find((row) => row.teamName === 'Alpha')!;
    expect(alpha.roundPoints.map((r) => [r.points, r.isJoker])).toEqual([
      [2, true],
      [0, false],
      [0, false],
    ]);
  });

  it('counts the joker a team changed its mind to, not the first one', async () => {
    const game = await playRoundOne([2, 0]);

    expect(await totals(game)).toEqual({ Alpha: 2, Bravo: 1 });
  });

  it('moves the totals when the answer key is fixed with new points', async () => {
    const game = await playRoundOne();

    await game.saveAnswerKeyFix(game.rounds[0].questionIds[0], { points: 3 });

    expect(await totals(game)).toEqual({ Alpha: 6, Bravo: 3 });
  });
});
