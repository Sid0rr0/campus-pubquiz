import { WsException } from '@nestjs/websockets';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import { asSocket, createMockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type JoinedTeam,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const TEAM_NAME = 'The Quizzards';

describe('GameGateway — one live connection per team + admin kick', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let first: JoinedTeam;

  beforeEach(async () => {
    game = await harness.createGateway();
    first = await game.joinTeam(TEAM_NAME);
  });

  /** A second device rejoining the team the way a phone does: with the team code it was given. */
  function rejoinPayload(extra: { previousSocketId?: string } = {}) {
    return {
      teamName: TEAM_NAME,
      joinCode: game.joinCode,
      teamCode: first.teamCode,
      ...extra,
    };
  }

  async function rosterTeamIds(): Promise<number[]> {
    return (await game.snapshot()).teams.map((team) => team.teamId);
  }

  it('rejects a second device joining the same team while the first is still connected', async () => {
    const second = await game.connectPlayer();

    await expect(
      game.gateway.handleJoinPlayers(asSocket(second), rejoinPayload()),
    ).rejects.toThrow(/already connected/i);
  });

  it('allows the same still-connected socket to re-join the team it already holds', async () => {
    await expect(
      game.gateway.handleJoinPlayers(asSocket(first.socket), rejoinPayload()),
    ).resolves.toBeUndefined();
  });

  it('allows a new device to join once the previous device disconnects', async () => {
    await game.gateway.handleDisconnect(asSocket(first.socket));
    const second = await game.connectPlayer();

    await expect(
      game.gateway.handleJoinPlayers(asSocket(second), rejoinPayload()),
    ).resolves.toBeUndefined();
  });

  it('allows a new device to join when the previous socket is stale (disconnect event has not fired yet)', async () => {
    // Simulate the transport already having dropped without our
    // handleDisconnect hook having run yet (e.g. a page-refresh race).
    first.socket.connected = false;
    const second = await game.connectPlayer();

    await expect(
      game.gateway.handleJoinPlayers(asSocket(second), rejoinPayload()),
    ).resolves.toBeUndefined();
  });

  it('lets a reconnecting device take over its own stale socket the server still thinks is live', async () => {
    // The phone's network dropped/slept and it reconnected on a fresh socket
    // before the server's ping timeout noticed the old one was dead.
    const second = await game.connectPlayer();

    await game.gateway.handleJoinPlayers(
      asSocket(second),
      rejoinPayload({ previousSocketId: first.socket.id }),
    );

    expect(first.socket.disconnect).toHaveBeenCalledWith(true);
    expect(second.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.JOIN_ACCEPTED,
      expect.objectContaining({ teamId: first.teamId }),
    );
  });

  it('still rejects a second device that names some other socket as its previous one', async () => {
    const second = await game.connectPlayer();

    await expect(
      game.gateway.handleJoinPlayers(
        asSocket(second),
        rejoinPayload({ previousSocketId: 'socket-zzz' }),
      ),
    ).rejects.toThrow(/already connected/i);
    expect(first.socket.disconnect).not.toHaveBeenCalled();
  });

  it('broadcasts STATE_UPDATED when a connected team disconnects', async () => {
    game.clearEmits();

    await game.gateway.handleDisconnect(asSocket(first.socket));

    for (const room of [
      SOCKET_ROOMS.DISPLAY,
      SOCKET_ROOMS.ADMIN,
      SOCKET_ROOMS.PLAYERS,
    ]) {
      expect(
        game.payloadsTo(room, SOCKET_EVENTS.STATE_UPDATED).length,
      ).toBeGreaterThan(0);
    }
  });

  it('does not broadcast when a socket with no connected team disconnects', async () => {
    const display = createMockSocket(
      SOCKET_ROOMS.DISPLAY,
      {},
      'display-1',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(display));
    game.clearEmits();

    await game.gateway.handleDisconnect(asSocket(display));

    expect(game.roomEmits()).toEqual([]);
  });

  it('rejects KICK_TEAM from a non-admin client', async () => {
    await expect(
      game.gateway.handleKickTeam(asSocket(first.socket), {
        teamId: first.teamId,
      }),
    ).rejects.toThrow(WsException);
    expect(await rosterTeamIds()).toEqual([first.teamId]);
  });

  it('notifies and disconnects the connected socket when the admin kicks its team', async () => {
    const admin = await game.connectAdmin();
    game.clearEmits();

    await game.gateway.handleKickTeam(asSocket(admin), {
      teamId: first.teamId,
    });

    expect(game.roomEmits()).toContainEqual(
      expect.objectContaining({
        rooms: [first.socket.id],
        event: SOCKET_EVENTS.TEAM_KICKED,
      }),
    );
    expect(first.socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('removes the team from the roster when the admin kicks it', async () => {
    const admin = await game.connectAdmin();

    await game.gateway.handleKickTeam(asSocket(admin), {
      teamId: first.teamId,
    });

    expect(await rosterTeamIds()).toEqual([]);
  });

  it('frees the connection slot so a new device can join after a kick', async () => {
    const admin = await game.connectAdmin();

    await game.gateway.handleKickTeam(asSocket(admin), {
      teamId: first.teamId,
    });
    // A real disconnect() call fires the socket.io 'disconnect' event,
    // which our gateway hooks via handleDisconnect.
    await game.gateway.handleDisconnect(asSocket(first.socket));

    const second = await game.connectPlayer();
    await expect(
      game.gateway.handleJoinPlayers(asSocket(second), rejoinPayload()),
    ).resolves.toBeUndefined();
  });

  it('removes a disconnected team from the roster without touching any socket', async () => {
    const admin = await game.connectAdmin();
    await game.gateway.handleDisconnect(asSocket(first.socket));
    game.clearEmits();

    await expect(
      game.gateway.handleKickTeam(asSocket(admin), { teamId: first.teamId }),
    ).resolves.toBeUndefined();

    expect(await rosterTeamIds()).toEqual([]);
    expect(
      game
        .roomEmits()
        .filter(({ event }) => event === SOCKET_EVENTS.TEAM_KICKED),
    ).toEqual([]);
  });

  it('rejects LEAVE_SESSION from a non-players client', async () => {
    const admin = await game.connectAdmin();

    await expect(
      game.gateway.handleLeaveSession(asSocket(admin), {
        teamId: first.teamId,
      }),
    ).rejects.toThrow(WsException);
  });

  it('rejects LEAVE_SESSION for a team the caller is not connected as', async () => {
    // A hand-crafted payload claiming a teamId this socket never joined as.
    await expect(
      game.gateway.handleLeaveSession(asSocket(first.socket), {
        teamId: first.teamId + 999,
      }),
    ).rejects.toThrow(/own team/i);
  });

  it('removes the team from the roster when it leaves on its own', async () => {
    await game.gateway.handleLeaveSession(asSocket(first.socket), {
      teamId: first.teamId,
    });

    expect(await rosterTeamIds()).toEqual([]);
  });

  it('frees the connection slot so a new device can join after leaving', async () => {
    await game.gateway.handleLeaveSession(asSocket(first.socket), {
      teamId: first.teamId,
    });

    const second = await game.connectPlayer();
    await expect(
      game.gateway.handleJoinPlayers(asSocket(second), rejoinPayload()),
    ).resolves.toBeUndefined();
  });

  it('broadcasts STATE_UPDATED to every room when a team leaves on its own', async () => {
    game.clearEmits();

    await game.gateway.handleLeaveSession(asSocket(first.socket), {
      teamId: first.teamId,
    });

    for (const room of [
      SOCKET_ROOMS.DISPLAY,
      SOCKET_ROOMS.ADMIN,
      SOCKET_ROOMS.PLAYERS,
    ]) {
      expect(
        game.payloadsTo(room, SOCKET_EVENTS.STATE_UPDATED).length,
      ).toBeGreaterThan(0);
    }
  });
});
