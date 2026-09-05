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
  asSocket,
  type MockServer,
} from './test-utils';

describe('GameGateway — set display text scale', () => {
  let gateway: GameGateway;
  let server: MockServer;

  beforeEach(async () => {
    ({ gateway, server } = await createTestGateway());
  });

  it('sets displayTextScale and broadcasts it to every room', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleSetDisplayTextScale(asSocket(admin), {
      displayTextScale: 1.5,
    });

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
      expect.objectContaining({ displayTextScale: 1.5 }),
    );
  });

  it('rejects SET_DISPLAY_TEXT_SCALE from a non-admin client', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await expect(
      gateway.handleSetDisplayTextScale(asSocket(player), {
        displayTextScale: 1.5,
      }),
    ).rejects.toThrow(WsException);
  });

  it('rejects a displayTextScale outside the supported steps', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));

    await expect(
      gateway.handleSetDisplayTextScale(asSocket(admin), {
        displayTextScale: 3,
      }),
    ).rejects.toThrow(WsException);
  });
});
