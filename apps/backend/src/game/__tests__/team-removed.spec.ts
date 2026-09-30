import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type SocketRoomName,
  type StateSnapshotPayload,
  sessionRoom,
} from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — team removed (kick / leave)', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let scorer: { socket: MockSocket; teamId: number };
  let bystander: { socket: MockSocket; teamId: number };

  beforeEach(async () => {
    game = await harness.createGateway({
      teamNames: ['The Quizzards', 'Bystanders'],
    });
    admin = await game.connectAdmin();
    [scorer, bystander] = game.teams;
    await game.openFirstQuestion(admin);
    await game.gateway.handleSubmitAnswer(asSocket(scorer.socket), {
      questionId: game.questionIds.multipleChoice,
      teamId: scorer.teamId,
      value: 'Paris',
    });
    game.clearEmits();
  });

  function lastSnapshot(room: SocketRoomName): StateSnapshotPayload {
    const fullRoom = sessionRoom(game.joinCode, room);
    const snapshots = game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(fullRoom) &&
          emit.event === SOCKET_EVENTS.STATE_UPDATED,
      )
      .map((emit) => emit.payload as StateSnapshotPayload);
    return snapshots[snapshots.length - 1];
  }

  function expectTeamGoneFromEveryRoom(teamId: number): void {
    for (const room of [
      SOCKET_ROOMS.ADMIN,
      SOCKET_ROOMS.DISPLAY,
      SOCKET_ROOMS.PLAYERS,
    ]) {
      const snapshot = lastSnapshot(room);
      expect(snapshot.teams.map((team) => team.teamId)).not.toContain(teamId);
      expect(snapshot.leaderboard.map((entry) => entry.teamId)).not.toContain(
        teamId,
      );
    }
  }

  it('drops a scoring team from the roster and leaderboard when it is kicked', async () => {
    await game.gateway.handleKickTeam(asSocket(admin), {
      teamId: scorer.teamId,
    });

    expectTeamGoneFromEveryRoom(scorer.teamId);
    expect(lastSnapshot(SOCKET_ROOMS.ADMIN).teams).toEqual([
      expect.objectContaining({ teamId: bystander.teamId }),
    ]);
  });

  it('drops a scoring team from the roster and leaderboard when it leaves', async () => {
    await game.gateway.handleLeaveSession(asSocket(scorer.socket), {
      teamId: scorer.teamId,
    });

    expectTeamGoneFromEveryRoom(scorer.teamId);
  });

  it('closes the ranks up behind a removed team', async () => {
    await game.gateway.handleKickTeam(asSocket(admin), {
      teamId: scorer.teamId,
    });

    expect(lastSnapshot(SOCKET_ROOMS.ADMIN).leaderboard).toEqual([
      expect.objectContaining({
        teamId: bystander.teamId,
        rank: 1,
        rankTo: 1,
      }),
    ]);
  });

  it('puts a newly joined team on the leaderboard at zero, sharing the bottom rank', async () => {
    const late = await game.joinTeam('Late Arrivals');

    const leaderboard = lastSnapshot(SOCKET_ROOMS.ADMIN).leaderboard;
    expect(leaderboard.map((entry) => entry.teamName)).toEqual([
      'The Quizzards',
      'Bystanders',
      'Late Arrivals',
    ]);
    expect(leaderboard[0]).toEqual(
      expect.objectContaining({ totalPoints: 2, rank: 1, rankTo: 1 }),
    );
    expect(leaderboard.slice(1)).toEqual([
      expect.objectContaining({
        teamId: bystander.teamId,
        totalPoints: 0,
        rank: 2,
        rankTo: 3,
      }),
      expect.objectContaining({
        teamId: late.teamId,
        totalPoints: 0,
        rank: 2,
        rankTo: 3,
      }),
    ]);
  });

  it('tells the kicked team’s socket and disconnects it', async () => {
    await game.gateway.handleKickTeam(asSocket(admin), {
      teamId: scorer.teamId,
    });

    expect(game.roomEmits()).toContainEqual(
      expect.objectContaining({
        rooms: [scorer.socket.id],
        event: SOCKET_EVENTS.TEAM_KICKED,
      }),
    );
    expect(scorer.socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('kicks a team whose socket has already disconnected', async () => {
    await game.gateway.handleDisconnect(asSocket(scorer.socket));
    game.clearEmits();

    await game.gateway.handleKickTeam(asSocket(admin), {
      teamId: scorer.teamId,
    });

    expectTeamGoneFromEveryRoom(scorer.teamId);
    expect(scorer.socket.disconnect).not.toHaveBeenCalled();
  });

  it('rejects leaving as another team with today’s message', async () => {
    await expect(
      game.gateway.handleLeaveSession(asSocket(scorer.socket), {
        teamId: bystander.teamId,
      }),
    ).rejects.toThrow('Can only leave the session as your own team');
  });
});
