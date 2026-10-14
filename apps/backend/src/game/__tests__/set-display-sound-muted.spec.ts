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

describe('GameGateway — set display sound muted', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway();
  });

  it('starts unmuted', async () => {
    expect((await game.snapshot()).isDisplaySoundMuted).toBe(false);
  });

  it('sets isDisplaySoundMuted and broadcasts it to every room', async () => {
    const admin = await game.connectAdmin();
    game.clearEmits();

    await game.gateway.handleSetDisplaySoundMuted(asSocket(admin), {
      isDisplaySoundMuted: true,
    });

    for (const room of [
      SOCKET_ROOMS.DISPLAY,
      SOCKET_ROOMS.ADMIN,
      SOCKET_ROOMS.PLAYERS,
    ]) {
      expect(
        game
          .payloadsTo<StateSnapshotPayload>(room, SOCKET_EVENTS.STATE_UPDATED)
          .at(-1)?.isDisplaySoundMuted,
      ).toBe(true);
    }
  });

  it('unmutes again', async () => {
    const admin = await game.connectAdmin();
    await game.gateway.handleSetDisplaySoundMuted(asSocket(admin), {
      isDisplaySoundMuted: true,
    });

    await game.gateway.handleSetDisplaySoundMuted(asSocket(admin), {
      isDisplaySoundMuted: false,
    });

    expect((await game.snapshot()).isDisplaySoundMuted).toBe(false);
  });

  it('rejects SET_DISPLAY_SOUND_MUTED from a non-admin client', async () => {
    const player = await game.connectPlayer();

    await expect(
      game.gateway.handleSetDisplaySoundMuted(asSocket(player), {
        isDisplaySoundMuted: true,
      }),
    ).resolves.toMatchObject({ success: false });
    expect((await game.snapshot()).isDisplaySoundMuted).toBe(false);
  });

  it('rejects a non-boolean isDisplaySoundMuted', async () => {
    const admin = await game.connectAdmin();

    await expect(
      game.gateway.handleSetDisplaySoundMuted(asSocket(admin), {
        isDisplaySoundMuted: 'yes',
      } as never),
    ).resolves.toMatchObject({ success: false });
    expect((await game.snapshot()).isDisplaySoundMuted).toBe(false);
  });
});
