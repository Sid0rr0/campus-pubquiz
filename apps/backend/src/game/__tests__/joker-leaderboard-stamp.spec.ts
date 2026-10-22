import { asSocket } from '@/game/__tests__/test-utils';
import {
  advanceToBlockBoard,
  advanceUntil,
  setupRealStoreGatewayTest,
  submitAnswers,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const question = (number: number) => ({
  type: 'multiple_choice' as const,
  prompt: `Question ${number}?`,
  answer: 'right',
  points: 1,
  payload: { options: ['right', 'wrong'] },
});

const THREE_ROUNDS: QuizRoundSpec[] = [1, 2, 3].map((number) => ({
  title: `Round ${number}`,
  breakAfter: true,
  questions: [question(number)],
}));

describe('GameGateway — the 2× stamp on the leaderboard', () => {
  const harness = setupRealStoreGatewayTest();

  /** Alpha bets on round 1, Bravo on round 2; the joker pick closes and the first question is open. */
  async function jokerNight(
    rounds: QuizRoundSpec[],
  ): Promise<RealStoreGateway> {
    const game = await harness.createGateway({
      rounds,
      teamNames: ['Alpha', 'Bravo'],
      settings: { showRoundOverview: true, jokersEnabled: true },
    });
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_overview
    await game.act('ADVANCE'); // -> joker_pick
    const [alpha, bravo] = game.teams;
    await game.gateway.handlePickJoker(asSocket(alpha.socket), {
      roundId: game.rounds[0].id,
    });
    await game.gateway.handlePickJoker(asSocket(bravo.socket), {
      roundId: game.rounds[1].id,
    });
    await advanceUntil(game, 'question_open');
    return game;
  }

  /** The team ids the big screen's leaderboard stamps. */
  async function stampedOnDisplay(game: RealStoreGateway): Promise<number[]> {
    const { screen } = await game.resync('display');
    if (screen.kind !== 'leaderboard') throw new Error('no leaderboard');
    return screen.board.jokerTeamIds ?? [];
  }

  async function stampedOnPhone(game: RealStoreGateway): Promise<number[]> {
    const view = await game.resync('players');
    return view.phoneLeaderboard.board.jokerTeamIds ?? [];
  }

  it('stamps the team whose joker round is in the block just scored, on the big screen and the phones', async () => {
    const game = await jokerNight(THREE_ROUNDS);
    await submitAnswers(game, ['right', 'right']);
    await advanceToBlockBoard(game);

    const [alpha] = game.teams;
    expect(await stampedOnDisplay(game)).toEqual([alpha.teamId]);
    expect(await stampedOnPhone(game)).toEqual([alpha.teamId]);
  });

  it('stamps a team that scored nothing in its joker round', async () => {
    const game = await jokerNight(THREE_ROUNDS);
    await submitAnswers(game, ['wrong', 'wrong']);
    await advanceToBlockBoard(game);

    expect(await stampedOnDisplay(game)).toEqual([game.teams[0].teamId]);
  });

  it('stamps only the block holding the joker round, not later ones', async () => {
    const game = await jokerNight(THREE_ROUNDS);
    await advanceToBlockBoard(game);
    await game.act('ADVANCE'); // leave the board
    await advanceUntil(game, 'question_open');
    await advanceToBlockBoard(game);

    expect(await stampedOnDisplay(game)).toEqual([game.teams[1].teamId]);

    await game.act('ADVANCE');
    await advanceUntil(game, 'question_open');
    await advanceToBlockBoard(game);

    expect(await stampedOnDisplay(game)).toEqual([]);
  });

  it('does not describe a stamp while a question is being answered', async () => {
    const game = await jokerNight(THREE_ROUNDS);

    expect(await stampedOnPhone(game)).toEqual([]);
  });

  it('stamps after each question of a kahoot joker round', async () => {
    const game = await jokerNight([
      {
        title: 'Kahoot',
        kahootMode: true,
        breakAfter: true,
        questions: [question(1), question(2)],
      },
      THREE_ROUNDS[1],
    ]);
    const [alpha] = game.teams;
    await advanceToBlockBoard(game);
    expect(await stampedOnDisplay(game)).toEqual([alpha.teamId]);

    await game.act('ADVANCE');
    await advanceToBlockBoard(game);
    expect(await stampedOnDisplay(game)).toEqual([alpha.teamId]);
  });
});
