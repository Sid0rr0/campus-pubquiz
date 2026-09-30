import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
} from '@campus-pubquiz/types';
import { asSocket, createMockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — notifySessionClosed', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway();
  });

  it("emits SESSION_CLOSED to the session's players room", () => {
    game.gateway.notifySessionClosed(game.joinCode);

    expect(game.roomEmits()).toEqual([
      {
        rooms: [sessionRoom(game.joinCode, SOCKET_ROOMS.PLAYERS)],
        event: SOCKET_EVENTS.SESSION_CLOSED,
        payload: { joinCode: game.joinCode },
      },
    ]);
  });

  it('does not target the display or admin rooms', () => {
    game.gateway.notifySessionClosed(game.joinCode);

    const rooms = game.roomEmits().flatMap((emit) => emit.rooms);
    expect(rooms).not.toContain(
      sessionRoom(game.joinCode, SOCKET_ROOMS.DISPLAY),
    );
    expect(rooms).not.toContain(sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN));
  });

  it('does not crash when a socket disconnects after its own session has been closed', async () => {
    const player = createMockSocket(
      SOCKET_ROOMS.PLAYERS,
      {},
      'player-1',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(player));

    // The seeded session is the default one, which closeSession refuses to
    // evict — creating a second session hands the default over to it, the
    // same way the real admin flow always has more than one session once a
    // second quiz is started.
    await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );
    await game.act('START_QUIZ');
    await game.act('END_QUIZ');
    game.gameState.closeSession(game.joinCode);

    await expect(
      game.gateway.handleDisconnect(asSocket(player)),
    ).resolves.toBeUndefined();
  });
});
