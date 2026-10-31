import {
  SOCKET_EVENTS,
  type AckResult,
  type TeamPurchasesSyncedPayload,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type JoinedTeam,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const QUIZ: QuizRoundSpec[] = [
  {
    title: 'Round 1',
    breakAfter: true,
    questions: [
      {
        type: 'sort',
        prompt: 'Smallest to largest',
        answer: 'Mouse|Cat|Dog|Horse',
        points: 2,
        payload: { options: ['Horse', 'Mouse', 'Dog', 'Cat'] },
      },
      {
        type: 'match',
        prompt: 'Match countries to capitals',
        answer: 'Paris|Rome',
        points: 2,
        payload: {
          options: ['France', 'Italy'],
          matchTargets: ['Rome', 'Paris'],
        },
      },
      {
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        answer: 'Paris',
        payload: { options: ['Paris', 'London', 'Berlin', 'Rome'] },
      },
    ],
  },
];

describe('GameGateway — buying a pin one', () => {
  const harness = setupRealStoreGatewayTest();

  async function night(random: () => number) {
    const game = await harness.createGateway({
      rounds: QUIZ,
      teamNames: ['Alpha'],
      settings: { powerUpsEnabled: true, startingCoins: 3 },
      jokerRandom: random,
    });
    await game.openFirstQuestion(await game.connectAdmin());
    return game;
  }

  function buy(
    game: RealStoreGateway,
    team: Pick<JoinedTeam, 'socket'>,
    questionId: number,
  ): Promise<AckResult> {
    return game.gateway.handleBuyPowerUp(asSocket(team.socket), {
      powerUp: 'pin_one',
      questionId,
    });
  }

  function stored(game: RealStoreGateway, team: JoinedTeam) {
    return game.inRequestContext(() =>
      game.purchaseService.listForTeam(game.gameSessionId, team.teamId),
    );
  }

  it('pins one item of a sort in its correct place and tells the team', async () => {
    const game = await night(() => 0.5);
    const [alpha] = game.teams;
    const [sort] = game.rounds[0].questionIds;
    game.clearEmits();

    expect(await buy(game, alpha, sort)).toEqual({ success: true });

    const [purchase] = await stored(game, alpha);
    expect(purchase.effect).toEqual({
      kind: 'pin_one',
      item: 'Dog',
      position: 2,
    });
    const sync = game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(alpha.socket.id) &&
          emit.event === SOCKET_EVENTS.TEAM_PURCHASES_SYNCED,
      )
      .map((emit) => emit.payload as TeamPurchasesSyncedPayload);
    expect(sync[0].purchases[0].effect).toEqual(purchase.effect);
    expect(sync[0].coins).toBe(1);
  });

  it('pins one pair of a match: the right-hand item beside its left item', async () => {
    const game = await night(() => 0.99);
    const [alpha] = game.teams;
    const [, match] = game.rounds[0].questionIds;
    await game.act('ADVANCE');

    expect(await buy(game, alpha, match)).toEqual({ success: true });

    const [purchase] = await stored(game, alpha);
    expect(purchase.effect).toEqual({
      kind: 'pin_one',
      item: 'Rome',
      position: 1,
    });
  });

  it('is not offered on a multiple-choice question', async () => {
    const game = await night(() => 0);
    const [alpha] = game.teams;
    const [, , choice] = game.rounds[0].questionIds;
    await game.act('ADVANCE');
    await game.act('ADVANCE');

    const ack = await buy(game, alpha, choice);

    expect(ack.success).toBe(false);
    expect(await stored(game, alpha)).toEqual([]);
  });
});
