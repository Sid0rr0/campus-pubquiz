import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type LeaderboardEntry,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — bonus changed and leaderboard toggle', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let scorer: { socket: MockSocket; teamId: number };
  let idle: { socket: MockSocket; teamId: number };

  beforeEach(async () => {
    game = await harness.createGateway({
      teamNames: ['The Quizzards', 'Idle Team'],
    });
    admin = await game.connectAdmin();
    [scorer, idle] = game.teams;
    await game.openFirstQuestion(admin);
    game.clearEmits();
  });

  function lastLeaderboard(): LeaderboardEntry[] {
    const adminRoom = sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN);
    const snapshots = game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(adminRoom) &&
          emit.event === SOCKET_EVENTS.STATE_UPDATED,
      )
      .map((emit) => emit.payload as StateSnapshotPayload);
    return snapshots[snapshots.length - 1].leaderboard;
  }

  function bonusOf(teamId: number): number | undefined {
    return lastLeaderboard().find((entry) => entry.teamId === teamId)
      ?.bonusPoints;
  }

  async function awardShot(points: number): Promise<number> {
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: scorer.teamId,
      category: 'shot',
      points,
    });
    const [award] = await game.inRequestContext(() =>
      game.bonusService.listForTeamAdmin(game.gameSessionId, scorer.teamId),
    );
    game.clearEmits();
    return award.id;
  }

  it('shows a socket bonus award in the next snapshot and notifies the awarded team', async () => {
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: scorer.teamId,
      category: 'shot',
      points: 1,
    });

    expect(bonusOf(scorer.teamId)).toBe(1);
    expect(game.roomEmits()).toContainEqual(
      expect.objectContaining({
        rooms: [scorer.socket.id],
        event: SOCKET_EVENTS.BONUS_AWARDED,
        payload: { category: 'shot', points: 1, reason: undefined },
      }),
    );
  });

  it('shows a REST bonus edit in the next snapshot', async () => {
    const awardId = await awardShot(1);
    await game.inRequestContext(() =>
      game.bonusService.update(game.gameSessionId, awardId, 3, undefined),
    );

    await game.gateway.notifyBonusAwardsChanged(game.joinCode);

    expect(bonusOf(scorer.teamId)).toBe(3);
  });

  it('shows a REST bonus deletion in the next snapshot', async () => {
    const awardId = await awardShot(1);
    await game.inRequestContext(() =>
      game.bonusService.remove(game.gameSessionId, awardId),
    );

    await game.gateway.notifyBonusAwardsChanged(game.joinCode);

    expect(bonusOf(scorer.teamId)).toBe(0);
  });

  it('shows every team, including 0-point teams, when the leaderboard is toggled on', async () => {
    await game.gateway.handleSubmitAnswer(asSocket(scorer.socket), {
      questionId: game.questionIds.multipleChoice,
      teamId: scorer.teamId,
      value: 'Paris',
    });
    game.clearEmits();

    await game.gateway.handleAdminAction(asSocket(admin), {
      action: 'TOGGLE_LEADERBOARD',
    });

    expect(lastLeaderboard()).toEqual([
      expect.objectContaining({ teamId: scorer.teamId, totalPoints: 2 }),
      expect.objectContaining({ teamId: idle.teamId, totalPoints: 0 }),
    ]);
  });

  it('still rejects an invalid bonus award with today’s message', async () => {
    await expect(
      game.gateway.handleAwardBonus(asSocket(admin), {
        teamId: idle.teamId,
        category: 'custom',
        points: 1,
      }),
    ).resolves.toEqual({
      success: false,
      error: 'A custom bonus needs a reason',
    });
    expect(game.roomEmits()).toEqual([]);
  });
});
