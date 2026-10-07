import type { StateSnapshotPayload } from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  holdNextCall,
  setupRealStoreGatewayTest,
  type JoinedTeam,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — join, leave and kick land in one order', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let team: JoinedTeam;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    admin = await game.connectAdmin();
    [team] = game.teams;
    game.clearEmits();
  });

  function rejoin(socket: MockSocket) {
    return game.gateway.handleJoinPlayers(asSocket(socket), {
      teamName: 'The Quizzards',
      joinCode: game.joinCode,
      teamToken: team.teamToken,
      previousSocketId: team.socket.id,
    });
  }

  function expectRosterAndLeaderboardAgree(
    snapshot: StateSnapshotPayload,
  ): void {
    const rosterIds = snapshot.teams.map((entry) => entry.teamId).sort();
    const leaderboardIds = snapshot.leaderboard
      .map((entry) => entry.teamId)
      .sort();
    expect(leaderboardIds).toEqual(rosterIds);
  }

  it('refuses a leave from the old socket queued behind a takeover rejoin, keeping the team on the roster and connected', async () => {
    const second = await game.connectPlayer();
    const held = holdNextCall(game.teamService, 'join');
    const joining = rejoin(second);
    await held.started;

    const waiting = game.nextWriteWaiting();
    const leaving = game.gateway.handleLeaveSession(asSocket(team.socket), {
      teamId: team.teamId,
    });
    await waiting;
    held.release();
    const [joined, left] = await Promise.all([joining, leaving]);

    expect(joined).toEqual({ success: true });
    expect(left).toEqual({
      success: false,
      error: expect.stringContaining('own team') as string,
    });
    const snapshot = await game.snapshot();
    expect(snapshot.teams).toEqual([
      { teamId: team.teamId, teamName: 'The Quizzards', isConnected: true },
    ]);
    expectRosterAndLeaderboardAgree(snapshot);
  });

  it('ends with the team kicked, not half joined, when a kick is queued behind its rejoin', async () => {
    const second = await game.connectPlayer();
    const held = holdNextCall(game.teamService, 'join');
    const joining = rejoin(second);
    await held.started;

    const waiting = game.nextWriteWaiting();
    const kicking = game.gateway.handleKickTeam(asSocket(admin), {
      teamId: team.teamId,
    });
    await waiting;
    held.release();
    await Promise.all([joining, kicking]);

    const snapshot = await game.snapshot();
    expect(snapshot.teams).toEqual([]);
    expectRosterAndLeaderboardAgree(snapshot);
  });

  it('keeps roster, connection and leaderboard in agreement when a rejoin is queued behind a kick', async () => {
    const second = await game.connectPlayer();
    const held = holdNextCall(game.teamService, 'removeFromRoster');
    const kicking = game.gateway.handleKickTeam(asSocket(admin), {
      teamId: team.teamId,
    });
    await held.started;

    const waiting = game.nextWriteWaiting();
    const joining = rejoin(second);
    await waiting;
    held.release();
    await Promise.all([kicking, joining]);

    expectRosterAndLeaderboardAgree(await game.snapshot());
  });
});
