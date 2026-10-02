import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type LeaderboardEntry,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  holdNextCall,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — session write: bonus changes', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let teamId: number;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    admin = await game.connectAdmin();
    teamId = game.teams[0].teamId;
    await game.openFirstQuestion(admin);
    game.clearEmits();
  });

  function adminSnapshots(joinCode = game.joinCode): StateSnapshotPayload[] {
    const adminRoom = sessionRoom(joinCode, SOCKET_ROOMS.ADMIN);
    return game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(adminRoom) &&
          emit.event === SOCKET_EVENTS.STATE_UPDATED,
      )
      .map((emit) => emit.payload as StateSnapshotPayload);
  }

  function bonusIn(snapshot: StateSnapshotPayload): number | undefined {
    return snapshot.leaderboard.find(
      (entry: LeaderboardEntry) => entry.teamId === teamId,
    )?.bonusPoints;
  }

  function award(points: number, socket = admin, forTeam = teamId) {
    return game.gateway.handleAwardBonus(asSocket(socket), {
      teamId: forTeam,
      category: 'shot',
      points,
    });
  }

  // Gives the second award time to be stored and (on code without a session
  // write) have its own standings read finish, so it is the older read that
  // lands last.
  async function secondAwardStored(): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const awards = await game.inRequestContext(() =>
        game.bonusService.listForTeamAdmin(game.gameSessionId, teamId),
      );
      if (awards.length === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  it('ends with both awards on the leaderboard when the first award’s standings read finishes last', async () => {
    const held = holdNextCall(game.standingsService, 'leaderboard');

    const first = award(1);
    await held.started;
    const second = award(2);
    await secondAwardStored();
    held.release();
    await Promise.all([first, second]);

    const snapshots = adminSnapshots();
    expect(bonusIn(snapshots[snapshots.length - 1])).toBe(3);
    const totals = snapshots.map((snapshot) => bonusIn(snapshot) ?? 0);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
  });

  it('does not make one session’s held bonus write delay a bonus write in another session', async () => {
    const { joinCode: otherCode } = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );
    const otherAdmin = await game.connectAdmin(otherCode);
    const other = await game.joinTeam('Other Team', otherCode);
    game.clearEmits();

    const held = holdNextCall(game.standingsService, 'leaderboard');
    const blocked = award(1);
    await held.started;

    await award(2, otherAdmin, other.teamId);

    const otherSnapshots = adminSnapshots(otherCode);
    expect(
      otherSnapshots[otherSnapshots.length - 1].leaderboard.find(
        (entry) => entry.teamId === other.teamId,
      )?.bonusPoints,
    ).toBe(2);
    held.release();
    await blocked;
  });

  it('leaves the session unchanged when a bonus write fails, returns the error, and still applies the next change', async () => {
    jest
      .spyOn(game.standingsService, 'leaderboard')
      .mockRejectedValueOnce(new Error('standings unavailable'));
    const before = await game.snapshot();

    await expect(award(1)).resolves.toEqual({
      success: false,
      error: 'Internal server error',
    });
    expect((await game.snapshot()).leaderboard).toEqual(before.leaderboard);

    game.clearEmits();
    await award(2);

    const snapshots = adminSnapshots();
    // Both awards are stored; the failed one's points show once standings are re-read.
    expect(bonusIn(snapshots[snapshots.length - 1])).toBe(3);
  });
});
