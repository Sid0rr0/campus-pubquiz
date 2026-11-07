import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_EVENTS,
  type TeamPurchasesSyncedPayload,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  advanceUntil,
  setupRealStoreGatewayTest,
  type JoinedTeam,
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

describe('GameGateway — a live edit and the extra jokers bought', () => {
  const harness = setupRealStoreGatewayTest();

  /** Alpha bought an extra joker for Round 1 (cost 1 of 5 coins), and the game stands at the round 1 intro. */
  async function withExtraOnRoundOne() {
    const game = await harness.createGateway({
      rounds: THREE_ROUNDS,
      teamNames: ['Alpha', 'Bravo'],
      settings: {
        powerUpsEnabled: true,
        startingCoins: 5,
        powerUps: {
          ...DEFAULT_SESSION_SETTINGS.powerUps,
          extra_joker: { cost: 1, maxUses: 2 },
        },
      },
    });
    await game.act('START_QUIZ');
    const [alpha] = game.teams;
    const ack = await game.gateway.handleBuyPowerUp(asSocket(alpha.socket), {
      powerUp: 'extra_joker',
      roundId: game.rounds[0].id,
    });
    expect(ack).toEqual({ success: true });
    game.clearEmits();
    return { game, alpha };
  }

  function stored(game: RealStoreGateway, team: JoinedTeam) {
    return game.inRequestContext(() =>
      game.purchaseService.listForTeam(game.gameSessionId, team.teamId),
    );
  }

  function syncsTo(game: RealStoreGateway, team: Pick<JoinedTeam, 'socket'>) {
    return game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(team.socket.id) &&
          emit.event === SOCKET_EVENTS.TEAM_PURCHASES_SYNCED,
      )
      .map((emit) => emit.payload as TeamPurchasesSyncedPayload);
  }

  it('follows the round it was bought for when the rounds are reordered', async () => {
    const { game, alpha } = await withExtraOnRoundOne();

    await game.saveQuizEdit((rounds) => [rounds[1], rounds[0], rounds[2]]);

    expect(syncsTo(game, alpha).at(-1)?.purchases[0].round?.roundNumber).toBe(
      2,
    );

    // Round 1 now sits second, on the second round row.
    expect(await stored(game, alpha)).toMatchObject([
      { powerUp: 'extra_joker', roundId: game.rounds[1].id, cost: 1 },
    ]);
    expect(syncsTo(game, alpha)).toMatchObject([
      { purchases: [{ roundId: game.rounds[1].id }], coins: 4 },
    ]);
  });

  // Round 1's row stays (it now holds Round 2) but none of Round 1's questions is left.
  it('is refunded when the edit deletes its round, and the phone hears the coin back', async () => {
    const { game, alpha } = await withExtraOnRoundOne();

    await game.saveQuizEdit((rounds) => [rounds[1], rounds[2]]);

    expect(await stored(game, alpha)).toEqual([]);
    expect(syncsTo(game, alpha).at(-1)).toEqual({ purchases: [], coins: 5 });
  });

  // The edit deletes the row the round sat on (the last one), and the database takes the purchase with it.
  it('keeps an extra joker on a round that survives while the row it sat on is deleted', async () => {
    const { game, alpha } = await withExtraOnRoundOne();
    await game.saveQuizEdit((rounds) => [rounds[1], rounds[2], rounds[0]]);
    game.clearEmits();

    await game.saveQuizEdit((rounds) => [rounds[1], rounds[2]]);

    expect(await stored(game, alpha)).toMatchObject([
      { powerUp: 'extra_joker', roundId: game.rounds[1].id },
    ]);
    expect(syncsTo(game, alpha).at(-1)?.coins).toBe(4);
  });

  it('refunds the second of two extra jokers that land on one round when rounds are merged', async () => {
    const { game, alpha } = await withExtraOnRoundOne();
    await advanceUntil(game, 'round_intro'); // round 1's intro is on air: round 2 is next
    expect(
      await game.gateway.handleBuyPowerUp(asSocket(alpha.socket), {
        powerUp: 'extra_joker',
        roundId: game.rounds[1].id,
      }),
    ).toEqual({ success: true });
    game.clearEmits();

    // Round 2's questions move into round 1: both purchases now double one round.
    await game.saveQuizEdit((rounds) => [
      {
        ...rounds[0],
        questions: [...rounds[0].questions, ...rounds[1].questions],
      },
      rounds[2],
    ]);

    expect(await stored(game, alpha)).toMatchObject([
      { powerUp: 'extra_joker', roundId: game.rounds[0].id },
    ]);
    expect(syncsTo(game, alpha).at(-1)?.coins).toBe(4);
  });

  it('keeps two extra jokers of one team on their own rounds', async () => {
    const { game, alpha } = await withExtraOnRoundOne();
    await advanceUntil(game, 'round_intro');
    await game.gateway.handleBuyPowerUp(asSocket(alpha.socket), {
      powerUp: 'extra_joker',
      roundId: game.rounds[1].id,
    });

    await game.saveQuizEdit((rounds) => [rounds[0], rounds[1], rounds[2]]);

    expect(await stored(game, alpha)).toMatchObject([
      { roundId: game.rounds[0].id },
      { roundId: game.rounds[1].id },
    ]);
  });

  it('sends no purchase sync in a session that does not offer extra jokers', async () => {
    const game = await harness.createGateway({
      rounds: THREE_ROUNDS,
      teamNames: ['Alpha'],
      settings: {
        powerUpsEnabled: true,
        powerUps: {
          ...DEFAULT_SESSION_SETTINGS.powerUps,
          extra_joker: { cost: 1, maxUses: 0 },
        },
      },
    });
    await game.act('START_QUIZ');
    game.clearEmits();

    await game.saveQuizEdit((rounds) => rounds);

    expect(syncsTo(game, game.teams[0])).toEqual([]);
  });

  it('leaves it alone when the edit does not touch the rounds', async () => {
    const { game, alpha } = await withExtraOnRoundOne();

    await game.saveQuizEdit((rounds) => rounds);

    expect(await stored(game, alpha)).toMatchObject([
      { roundId: game.rounds[0].id },
    ]);
    expect(syncsTo(game, alpha).at(-1)?.coins).toBe(4);
  });
});
