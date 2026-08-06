import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
} from '@campus-pubquiz/types';
import {
  asSocket,
  createMockSocket,
  createTestGateway,
  type TestGateway,
} from './test-utils';

describe('GameGateway — notifySessionClosed', () => {
  let testGateway: TestGateway;

  beforeEach(async () => {
    testGateway = await createTestGateway();
  });

  it("emits SESSION_CLOSED to the session's players room", () => {
    const { gateway, server } = testGateway;

    gateway.notifySessionClosed('ABCDEF');

    expect(server.to).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.PLAYERS),
    );
    expect(server.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SESSION_CLOSED, {
      joinCode: 'ABCDEF',
    });
  });

  it('does not target the display or admin rooms', () => {
    const { gateway, server } = testGateway;

    gateway.notifySessionClosed('ABCDEF');

    expect(server.to).not.toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.DISPLAY),
    );
    expect(server.to).not.toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.ADMIN),
    );
  });

  it('does not crash when a socket disconnects after its own session has been closed', async () => {
    const { gateway, gameStateService } = testGateway;

    const player = createMockSocket(
      SOCKET_ROOMS.PLAYERS,
      {},
      'player-1',
      'ABCDEF',
    );
    await gateway.handleConnection(asSocket(player));

    // ABCDEF is the fixture's default session, which closeSession refuses to
    // evict — creating a second session hands the default over to it, the
    // same way the real admin flow always has more than one session once a
    // second quiz is started.
    await gameStateService.createSession(2);
    await gameStateService.applyAction('ABCDEF', 'START_QUIZ');
    await gameStateService.applyAction('ABCDEF', 'END_QUIZ');
    gameStateService.closeSession('ABCDEF');

    expect(() => gateway.handleDisconnect(asSocket(player))).not.toThrow();
  });
});
