import {
  TEST_ADMIN_USER,
  TEST_MODERATOR_USER,
} from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('SessionBroadcaster — disconnectUser', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway();
  });

  it('disconnects every live admin socket belonging to that user', async () => {
    const first = await game.connectAdmin();
    const second = await game.connectAdmin();

    game.broadcaster.disconnectUser(TEST_ADMIN_USER.id);

    // true closes the underlying connection, not just the namespace.
    expect(first.disconnect).toHaveBeenCalledWith(true);
    expect(second.disconnect).toHaveBeenCalledWith(true);
  });

  it("leaves other users' admin sockets and player sockets connected", async () => {
    game.sessionService.validate.mockResolvedValueOnce({
      user: TEST_MODERATOR_USER,
    });
    const moderator = await game.connectAdmin();
    const player = await game.connectPlayer();

    game.broadcaster.disconnectUser(TEST_ADMIN_USER.id);

    expect(moderator.disconnect).not.toHaveBeenCalled();
    expect(player.disconnect).not.toHaveBeenCalled();
  });
});
