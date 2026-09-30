import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
} from '@campus-pubquiz/types';
import {
  TEST_MODERATOR_USER,
  TEST_SESSION_TOKEN,
  asSocket,
  createMockSocket,
} from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — connection', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway();
  });

  it('joins a connecting display client to the display room and sends a state snapshot', async () => {
    const client = createMockSocket(
      SOCKET_ROOMS.DISPLAY,
      {},
      'socket-1',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(client));

    expect(client.join).toHaveBeenCalledWith(
      sessionRoom(game.joinCode, SOCKET_ROOMS.DISPLAY),
    );
    expect(client.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_SYNC,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining resolves to `any` in @types/jest
        progress: expect.objectContaining({ status: 'lobby' }),
      }),
    );
  });

  it('includes the session join code in the snapshot sent on connection', async () => {
    const client = createMockSocket(
      SOCKET_ROOMS.DISPLAY,
      {},
      'socket-1',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(client));

    expect(client.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_SYNC,
      expect.objectContaining({ joinCode: game.joinCode }),
    );
  });

  it('disconnects a client that connects without a recognized role', async () => {
    const client = createMockSocket(
      'not-a-real-room',
      {},
      'socket-1',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(client));

    expect(client.join).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('disconnects a client that connects with no role at all', async () => {
    const client = createMockSocket(undefined, {}, 'socket-1', game.joinCode);
    await game.gateway.handleConnection(asSocket(client));

    expect(client.join).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('disconnects a client that connects with no session code at all', async () => {
    const client = createMockSocket(SOCKET_ROOMS.DISPLAY, {}, 'socket-1', null);
    await game.gateway.handleConnection(asSocket(client));

    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(
      'exception',
      'Unknown game session code',
    );
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('disconnects a client that connects with an unrecognized session code', async () => {
    const client = createMockSocket(
      SOCKET_ROOMS.DISPLAY,
      {},
      'socket-1',
      'NOTREAL',
    );
    await game.gateway.handleConnection(asSocket(client));

    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(
      'exception',
      'Unknown game session code',
    );
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('joins an admin client that presents a valid session token', async () => {
    const admin = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'socket-1',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(admin));

    expect(admin.join).toHaveBeenCalledWith(
      sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN),
    );
    expect(admin.disconnect).not.toHaveBeenCalled();
  });

  it('sends presenter context to a connecting admin client, so /remote has something to show before the next admin action', async () => {
    const admin = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'socket-1',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(admin));

    expect(admin.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED,
      expect.objectContaining({ currentQuestionNotes: null }),
    );
  });

  it('never sends presenter context to a connecting display client', async () => {
    const client = createMockSocket(
      SOCKET_ROOMS.DISPLAY,
      {},
      'socket-1',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(client));

    expect(client.emit).not.toHaveBeenCalledWith(
      SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED,
      expect.anything(),
    );
  });

  it('joins a moderator client that presents a valid session token', async () => {
    const moderatorToken = 'moderator-token';
    game.sessionService.validate.mockImplementation(
      (token: string | undefined) =>
        Promise.resolve(
          token === moderatorToken ? { user: TEST_MODERATOR_USER } : null,
        ),
    );
    const moderator = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: moderatorToken },
      'socket-1',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(moderator));

    expect(moderator.join).toHaveBeenCalledWith(
      sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN),
    );
    expect(moderator.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects an admin client with an invalid or expired token', async () => {
    const admin = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: 'wrong-token' },
      'socket-1',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(admin));

    expect(admin.join).not.toHaveBeenCalled();
    expect(admin.emit).toHaveBeenCalledWith(
      'exception',
      'Invalid or expired session',
    );
    expect(admin.disconnect).toHaveBeenCalled();
  });

  it('disconnects an admin client with no token at all', async () => {
    const admin = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      {},
      'socket-1',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(admin));

    expect(admin.join).not.toHaveBeenCalled();
    expect(admin.emit).toHaveBeenCalledWith(
      'exception',
      'Invalid or expired session',
    );
    expect(admin.disconnect).toHaveBeenCalled();
  });
});
