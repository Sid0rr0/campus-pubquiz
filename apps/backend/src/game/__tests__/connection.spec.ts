import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import type { GameGateway } from '@/game/game.gateway';
import {
  ADMIN_PASSWORD,
  createMockSocket,
  createTestGateway,
  asSocket,
  useAdminPasswordEnv,
  type MockServer,
} from './test-utils';

describe('GameGateway — connection', () => {
  useAdminPasswordEnv();

  let gateway: GameGateway;
  let server: MockServer;

  beforeEach(async () => {
    ({ gateway, server } = await createTestGateway());
  });

  it('joins a connecting display client to the display room and sends a state snapshot', async () => {
    const client = createMockSocket(SOCKET_ROOMS.DISPLAY);
    await gateway.handleConnection(asSocket(client));

    expect(client.join).toHaveBeenCalledWith(SOCKET_ROOMS.DISPLAY);
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

  it('joins an admin client that presents the correct password', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    expect(admin.join).toHaveBeenCalledWith(SOCKET_ROOMS.ADMIN);
    expect(admin.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects an admin client with the wrong password', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: 'wrong-password',
    });
    await gateway.handleConnection(asSocket(admin));

    expect(admin.join).not.toHaveBeenCalled();
    expect(admin.emit).toHaveBeenCalledWith(
      'exception',
      'Invalid admin password',
    );
    expect(admin.disconnect).toHaveBeenCalled();
  });

  it('disconnects an admin client with no password at all', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN);
    await gateway.handleConnection(asSocket(admin));

    expect(admin.join).not.toHaveBeenCalled();
    expect(admin.emit).toHaveBeenCalledWith(
      'exception',
      'Invalid admin password',
    );
    expect(admin.disconnect).toHaveBeenCalled();
  });
});
