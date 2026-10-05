import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — award bonus', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let team: { socket: MockSocket; teamId: number };

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    admin = await game.connectAdmin();
    [team] = game.teams;
    game.clearEmits();
  });

  function storedBonuses() {
    return game.inRequestContext(() =>
      game.bonusService.listForTeam(game.gameSessionId, team.teamId),
    );
  }

  it('awards a predefined-category bonus and refreshes the leaderboard for all rooms', async () => {
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: team.teamId,
      category: 'shot',
      points: 1,
    });

    for (const room of [
      SOCKET_ROOMS.DISPLAY,
      SOCKET_ROOMS.ADMIN,
      SOCKET_ROOMS.PLAYERS,
    ]) {
      const snapshots = game.payloadsTo<StateSnapshotPayload>(
        room,
        SOCKET_EVENTS.STATE_UPDATED,
      );
      expect(snapshots[snapshots.length - 1].leaderboard).toEqual([
        expect.objectContaining({
          teamId: team.teamId,
          teamName: 'The Quizzards',
          bonusPoints: 1,
        }),
      ]);
    }
    expect(await storedBonuses()).toEqual([
      expect.objectContaining({ category: 'shot', points: 1 }),
    ]);
  });

  it('awards a custom bonus with an admin-written reason', async () => {
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: team.teamId,
      category: 'custom',
      reason: 'Best team name',
      points: 3,
    });

    expect(await storedBonuses()).toEqual([
      expect.objectContaining({
        category: 'custom',
        points: 3,
        reason: 'Best team name',
      }),
    ]);
  });

  it('pushes the award privately to the awarded team’s own connected socket', async () => {
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: team.teamId,
      category: 'selfie',
      points: 1,
    });

    expect(game.roomEmits()).toContainEqual(
      expect.objectContaining({
        rooms: [team.socket.id],
        event: SOCKET_EVENTS.BONUS_AWARDED,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining resolves to `any` in @types/jest
        payload: expect.objectContaining({ category: 'selfie', points: 1 }),
      }),
    );
  });

  it('does not try to push the award to a team that is not currently connected', async () => {
    await game.gateway.handleDisconnect(asSocket(team.socket));
    game.clearEmits();

    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: team.teamId,
      category: 'shot',
      points: 1,
    });

    expect(game.roomEmits().map((emit) => emit.event)).not.toContain(
      SOCKET_EVENTS.BONUS_AWARDED,
    );
    expect(await storedBonuses()).toHaveLength(1);
  });

  it('rejects AWARD_BONUS from a non-admin client', async () => {
    await expect(
      game.gateway.handleAwardBonus(asSocket(team.socket), {
        teamId: team.teamId,
        category: 'shot',
        points: 1,
      }),
    ).resolves.toMatchObject({ success: false });

    expect(await storedBonuses()).toEqual([]);
  });

  it('surfaces a validation error from BonusService as a WsException', async () => {
    await expect(
      game.gateway.handleAwardBonus(asSocket(admin), {
        teamId: team.teamId,
        category: 'custom',
        points: 1,
      }),
    ).resolves.toMatchObject({ success: false });

    expect(await storedBonuses()).toEqual([]);
  });

  it('refuses a bonus in a category the session has disabled, with today’s message', async () => {
    await game.inRequestContext(() =>
      game.gameState.updateSessionSettings(game.joinCode, {
        enabledBonusCategories: ['shot'],
      }),
    );

    await expect(
      game.gateway.handleAwardBonus(asSocket(admin), {
        teamId: team.teamId,
        category: 'selfie',
        points: 1,
      }),
    ).resolves.toEqual({
      success: false,
      error: expect.stringContaining(
        '"selfie" is not enabled for this session',
      ) as string,
    });
  });

  it('refuses a bonus over the per-category limit, with today’s message', async () => {
    await game.inRequestContext(() =>
      game.gameState.updateSessionSettings(game.joinCode, {
        maxBonusAwardsPerCategory: { shot: 1 },
      }),
    );
    const award = () =>
      game.gateway.handleAwardBonus(asSocket(admin), {
        teamId: team.teamId,
        category: 'shot',
        points: 1,
      });
    await award();

    await expect(award()).resolves.toEqual({
      success: false,
      error: expect.stringContaining(
        'This team has already been awarded the "shot" bonus the maximum 1 time(s)',
      ) as string,
    });
  });
});
