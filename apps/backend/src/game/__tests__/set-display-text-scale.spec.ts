import { WsException } from '@nestjs/websockets';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — set display text scale', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway();
  });

  it('sets displayTextScale and broadcasts it to every room', async () => {
    const admin = await game.connectAdmin();
    game.clearEmits();

    await game.gateway.handleSetDisplayTextScale(asSocket(admin), {
      displayTextScale: 1.5,
    });

    for (const room of [
      SOCKET_ROOMS.DISPLAY,
      SOCKET_ROOMS.ADMIN,
      SOCKET_ROOMS.PLAYERS,
    ]) {
      expect(
        game
          .payloadsTo<StateSnapshotPayload>(room, SOCKET_EVENTS.STATE_UPDATED)
          .at(-1)?.displayTextScale,
      ).toBe(1.5);
    }
  });

  it('rejects SET_DISPLAY_TEXT_SCALE from a non-admin client', async () => {
    const player = await game.connectPlayer();

    await expect(
      game.gateway.handleSetDisplayTextScale(asSocket(player), {
        displayTextScale: 1.5,
      }),
    ).rejects.toThrow(WsException);
    expect((await game.snapshot()).displayTextScale).toBe(1);
  });

  it('rejects a displayTextScale outside the supported steps', async () => {
    const admin = await game.connectAdmin();

    await expect(
      game.gateway.handleSetDisplayTextScale(asSocket(admin), {
        displayTextScale: 3,
      }),
    ).rejects.toThrow(WsException);
    expect((await game.snapshot()).displayTextScale).toBe(1);
  });
});
