import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
} from '@campus-pubquiz/types';
import type { GameGateway } from '@/game/game.gateway';
import {
  TEST_MODERATOR_USER,
  TEST_SESSION_TOKEN,
  createMockSocket,
  createTestGateway,
  asSocket,
  type MockSessionService,
} from './test-utils';

describe('GameGateway — connection', () => {
  let gateway: GameGateway;
  let sessionService: MockSessionService;

  beforeEach(async () => {
    ({ gateway, sessionService } = await createTestGateway());
  });

  it('joins a connecting display client to the display room and sends a state snapshot', async () => {
    const client = createMockSocket(SOCKET_ROOMS.DISPLAY);
    await gateway.handleConnection(asSocket(client));

    expect(client.join).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.DISPLAY),
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
    const client = createMockSocket(SOCKET_ROOMS.DISPLAY);
    await gateway.handleConnection(asSocket(client));

    expect(client.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_SYNC,
      expect.objectContaining({ joinCode: 'ABCDEF' }),
    );
  });

  it('disconnects a client that connects without a recognized role', async () => {
    const client = createMockSocket('not-a-real-room');
    await gateway.handleConnection(asSocket(client));

    expect(client.join).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('disconnects a client that connects with no role at all', async () => {
    const client = createMockSocket();
    await gateway.handleConnection(asSocket(client));

    expect(client.join).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('disconnects a client that connects with no session code at all', async () => {
    const client = createMockSocket(SOCKET_ROOMS.DISPLAY, {}, 'socket-1', null);
    await gateway.handleConnection(asSocket(client));

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
    await gateway.handleConnection(asSocket(client));

    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(
      'exception',
      'Unknown game session code',
    );
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('joins an admin client that presents a valid session token', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    expect(admin.join).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.ADMIN),
    );
    expect(admin.disconnect).not.toHaveBeenCalled();
  });

  it('joins a moderator client that presents a valid session token', async () => {
    const moderatorToken = 'moderator-token';
    sessionService.validate.mockImplementation((token: string | undefined) =>
      Promise.resolve(
        token === moderatorToken ? { user: TEST_MODERATOR_USER } : null,
      ),
    );
    const moderator = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: moderatorToken,
    });
    await gateway.handleConnection(asSocket(moderator));

    expect(moderator.join).toHaveBeenCalledWith(
      sessionRoom('ABCDEF', SOCKET_ROOMS.ADMIN),
    );
    expect(moderator.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects an admin client with an invalid or expired token', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: 'wrong-token',
    });
    await gateway.handleConnection(asSocket(admin));

    expect(admin.join).not.toHaveBeenCalled();
    expect(admin.emit).toHaveBeenCalledWith(
      'exception',
      'Invalid or expired session',
    );
    expect(admin.disconnect).toHaveBeenCalled();
  });

  it('disconnects an admin client with no token at all', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN);
    await gateway.handleConnection(asSocket(admin));

    expect(admin.join).not.toHaveBeenCalled();
    expect(admin.emit).toHaveBeenCalledWith(
      'exception',
      'Invalid or expired session',
    );
    expect(admin.disconnect).toHaveBeenCalled();
  });
});
