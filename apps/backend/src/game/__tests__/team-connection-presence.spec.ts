import { WsException } from '@nestjs/websockets';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
} from '@campus-pubquiz/types';
import type { GameGateway } from '@/game/game.gateway';
import {
  TEST_SESSION_TOKEN,
  createMockSocket,
  createTestGateway,
  connectPlayer,
  asSocket,
  type MockServer,
  type MockSocket,
} from './test-utils';

describe('GameGateway — one live connection per team + admin kick', () => {
  let gateway: GameGateway;
  let server: MockServer;

  beforeEach(async () => {
    ({ gateway, server } = await createTestGateway());
  });

  async function joinAsPlayer(id: string): Promise<MockSocket> {
    const player = await connectPlayer(gateway, server, id);
    await gateway.handleJoinPlayers(asSocket(player), {
      teamName: 'The Quizzards',
      joinCode: 'ABCDEF',
    });
    return player;
  }

  it('rejects a second device joining the same team while the first is still connected', async () => {
    await joinAsPlayer('socket-a');
    const playerB = await connectPlayer(gateway, server, 'socket-b');

    await expect(
      gateway.handleJoinPlayers(asSocket(playerB), {
        teamName: 'The Quizzards',
        joinCode: 'ABCDEF',
      }),
    ).rejects.toThrow(/already connected/i);
  });

  it('allows the same still-connected socket to re-join the team it already holds', async () => {
    const playerA = await joinAsPlayer('socket-a');

    await expect(
      gateway.handleJoinPlayers(asSocket(playerA), {
        teamName: 'The Quizzards',
        joinCode: 'ABCDEF',
      }),
    ).resolves.toBeUndefined();
  });

  it('allows a new device to join once the previous device disconnects', async () => {
    const playerA = await joinAsPlayer('socket-a');
    gateway.handleDisconnect(asSocket(playerA));
    const playerB = await connectPlayer(gateway, server, 'socket-b');

    await expect(
      gateway.handleJoinPlayers(asSocket(playerB), {
        teamName: 'The Quizzards',
        joinCode: 'ABCDEF',
      }),
    ).resolves.toBeUndefined();
  });

  it('allows a new device to join when the previous socket is stale (disconnect event has not fired yet)', async () => {
    const playerA = await joinAsPlayer('socket-a');
    // Simulate the transport already having dropped without our
    // handleDisconnect hook having run yet (e.g. a page-refresh race).
    playerA.connected = false;
    const playerB = await connectPlayer(gateway, server, 'socket-b');

    await expect(
      gateway.handleJoinPlayers(asSocket(playerB), {
        teamName: 'The Quizzards',
        joinCode: 'ABCDEF',
      }),
    ).resolves.toBeUndefined();
  });

  it('broadcasts STATE_UPDATED when a connected team disconnects', async () => {
    const playerA = await joinAsPlayer('socket-a');
    server.to.mockClear();
    server.emit.mockClear();

    gateway.handleDisconnect(asSocket(playerA));

    expect(server.to).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.DISPLAY),
    );
    expect(server.to).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.ADMIN),
    );
    expect(server.to).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.PLAYERS),
    );
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.anything(),
    );
  });

  it('does not broadcast when a socket with no connected team disconnects', async () => {
    const display = createMockSocket(SOCKET_ROOMS.DISPLAY);
    await gateway.handleConnection(asSocket(display));
    server.to.mockClear();
    server.emit.mockClear();

    gateway.handleDisconnect(asSocket(display));

    expect(server.emit).not.toHaveBeenCalled();
  });

  it('rejects KICK_TEAM from a non-admin client', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    expect(() =>
      gateway.handleKickTeam(asSocket(player), { teamId: 31 }),
    ).toThrow(WsException);
  });

  it('notifies and disconnects the connected socket when the admin kicks its team', async () => {
    const playerA = await joinAsPlayer('socket-a');
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    gateway.handleKickTeam(asSocket(admin), { teamId: 31 });

    expect(playerA.emit).toHaveBeenCalledWith(
      'exception',
      'You were removed from this team by the quiz master',
    );
    expect(playerA.disconnect).toHaveBeenCalledWith(true);
  });

  it('frees the connection slot so a new device can join after a kick', async () => {
    const playerA = await joinAsPlayer('socket-a');
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    gateway.handleKickTeam(asSocket(admin), { teamId: 31 });
    // A real disconnect() call fires the socket.io 'disconnect' event,
    // which our gateway hooks via handleDisconnect.
    gateway.handleDisconnect(asSocket(playerA));

    const playerB = await connectPlayer(gateway, server, 'socket-b');
    await expect(
      gateway.handleJoinPlayers(asSocket(playerB), {
        teamName: 'The Quizzards',
        joinCode: 'ABCDEF',
      }),
    ).resolves.toBeUndefined();
  });

  it('does nothing when kicking a team that has no connected socket', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    expect(() =>
      gateway.handleKickTeam(asSocket(admin), { teamId: 999 }),
    ).not.toThrow();
  });
});
