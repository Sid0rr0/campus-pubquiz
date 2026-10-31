import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type JoinedTeam,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('Coin awards', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let team: JoinedTeam;

  async function start(powerUpsEnabled = true): Promise<void> {
    game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      settings: { powerUpsEnabled, startingCoins: 1 },
    });
    admin = await game.connectAdmin();
    [team] = game.teams;
    game.clearEmits();
  }

  function adminCoins(from: RealStoreGateway = game): number {
    return from.gameState.getView(from.joinCode, SOCKET_ROOMS.ADMIN).teams[0]
      .coins;
  }

  function emitted(event: string) {
    return game
      .roomEmits()
      .filter((emit) => emit.event === event)
      .map(({ rooms, payload }) => ({ rooms, payload }));
  }

  async function award(
    payload: Partial<Parameters<typeof game.gateway.handleAwardBonus>[1]>,
  ) {
    return game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: team.teamId,
      category: 'shot',
      points: 1,
      ...payload,
    });
  }

  async function bonusAwardId(): Promise<number> {
    const [first] = await game.inRequestContext(() =>
      game.bonusService.listForTeamAdmin(game.gameSessionId, team.teamId),
    );
    return first.id;
  }

  it('gives a shot a linked +2 coins, toasts it, and takes it away with the deleted bonus award', async () => {
    await start();

    await award({ category: 'shot', points: 1 });

    expect(adminCoins()).toBe(3);
    expect(emitted(SOCKET_EVENTS.COIN_AWARDED)).toEqual([
      {
        rooms: [team.socket.id],
        payload: { coins: 2, reason: undefined, balance: 3 },
      },
    ]);

    const awardId = await bonusAwardId();
    game.clearEmits();
    await game.inRequestContext(() =>
      game.rest.removeBonus(game.joinCode, awardId),
    );

    expect(adminCoins()).toBe(1);
    expect(emitted(SOCKET_EVENTS.TEAM_COINS_SYNCED)).toEqual([
      {
        rooms: [team.socket.id],
        payload: { balance: 1, hasCarriedCoin: false },
      },
    ]);
    expect(emitted(SOCKET_EVENTS.COIN_AWARDED)).toEqual([]);
  });

  it('leaves the linked coin alone when the bonus award’s points are edited', async () => {
    await start();
    await award({ category: 'selfie', points: 1 });
    const awardId = await bonusAwardId();
    game.clearEmits();

    await game.inRequestContext(() =>
      game.rest.editBonus(game.joinCode, awardId, 5, undefined),
    );

    expect(adminCoins()).toBe(3);
    expect(emitted(SOCKET_EVENTS.TEAM_COINS_SYNCED)).toEqual([]);
  });

  it('gives no coin for a shot award that takes points away', async () => {
    await start();

    await award({ category: 'shot', points: -5 });

    expect(adminCoins()).toBe(1);
    expect(emitted(SOCKET_EVENTS.COIN_AWARDED)).toEqual([]);
  });

  it('gives no coin for a custom bonus award', async () => {
    await start();

    await award({ category: 'custom', points: 1, reason: 'Best costume' });

    expect(adminCoins()).toBe(1);
    expect(emitted(SOCKET_EVENTS.COIN_AWARDED)).toEqual([]);
  });

  it('gives coins alone with 0 points, with no bonus award and no bonus toast', async () => {
    await start();

    const result = await award({
      category: 'custom',
      points: 0,
      coins: 3,
      reason: 'Trivia hero',
    });

    expect(result).toEqual({ success: true });
    expect(adminCoins()).toBe(4);
    expect(emitted(SOCKET_EVENTS.BONUS_AWARDED)).toEqual([]);
    expect(emitted(SOCKET_EVENTS.COIN_AWARDED)).toEqual([
      {
        rooms: [team.socket.id],
        payload: { coins: 3, reason: 'Trivia hero', balance: 4 },
      },
    ]);
    await expect(
      game.inRequestContext(() =>
        game.bonusService.listForTeamAdmin(game.gameSessionId, team.teamId),
      ),
    ).resolves.toEqual([]);
  });

  it('adds manual coins beside a points award and takes them back down to 0', async () => {
    await start();

    await award({ category: 'shot', points: 1, coins: 2 });
    expect(adminCoins()).toBe(5);

    await award({ category: 'custom', points: 0, coins: -5 });
    expect(adminCoins()).toBe(0);
    expect(emitted(SOCKET_EVENTS.COIN_AWARDED).at(-1)?.payload).toEqual(
      expect.objectContaining({ coins: -5, balance: 0 }),
    );
  });

  it('refuses a take of more coins than the team has, with its points, and changes nothing', async () => {
    await start();

    const ack = await award({ category: 'shot', points: 1, coins: -10 });

    expect(ack).toEqual({
      success: false,
      error: 'That team has only 1 coin to take',
    });
    expect(adminCoins()).toBe(1);
    expect(
      await game.inRequestContext(() =>
        game.bonusService.listForTeamAdmin(game.gameSessionId, team.teamId),
      ),
    ).toEqual([]);
  });

  it('refuses to take coins from a team with none', async () => {
    await start();
    await award({ category: 'custom', points: 0, coins: -1 });

    const ack = await award({ category: 'custom', points: 0, coins: -1 });

    expect(ack).toEqual({
      success: false,
      error: 'That team has only 0 coins to take',
    });
  });

  it('keeps coin awards across a rejoin and a backend restart', async () => {
    await start();
    await award({ category: 'shot', points: 1 });

    const restarted = await game.restart();

    const device = await restarted.connectPlayer();
    await restarted.gateway.handleJoinPlayers(asSocket(device), {
      teamName: 'The Quizzards',
      teamToken: team.teamToken,
      joinCode: restarted.joinCode,
    });
    expect(adminCoins(restarted)).toBe(3);
    expect(device.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.JOIN_ACCEPTED,
      expect.objectContaining({ coins: 3 }),
    );
  });

  it('lists the team’s coin awards for the quiz master, oldest first, with each reason', async () => {
    await start();
    await award({ category: 'shot', points: 1 });
    await award({ points: 0, coins: -3, reason: 'Phone out' });

    const { coinAwards } = await game.inRequestContext(() =>
      game.rest.listBonusAwards(game.joinCode, team.teamId),
    );

    expect(coinAwards).toMatchObject([
      { coins: 2 },
      { coins: -3, reason: 'Phone out' },
    ]);
  });

  it('gives no coins in a session without power-ups and refuses a coins field', async () => {
    await start(false);

    await award({ category: 'shot', points: 1 });
    expect(adminCoins()).toBe(0);
    expect(emitted(SOCKET_EVENTS.COIN_AWARDED)).toEqual([]);

    await expect(award({ points: 0, coins: 2 })).resolves.toEqual({
      success: false,
      error: 'Coins can only be awarded in a session with power-ups',
    });
  });

  it('refuses an award of 0 points and 0 coins', async () => {
    await start();

    await expect(award({ points: 0, coins: 0 })).resolves.toEqual({
      success: false,
      error: 'Bonus points must be a non-zero number',
    });
  });
});
