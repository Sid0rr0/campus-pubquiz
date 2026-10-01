import {
  TEST_ADMIN_USER,
  TEST_MODERATOR_USER,
} from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — disconnectUser', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway();
  });

  it('disconnects every live admin socket belonging to that user', async () => {
    const first = await game.connectAdmin();
    const second = await game.connectAdmin();

    game.gateway.disconnectUser(TEST_ADMIN_USER.id);

    expect(first.disconnect).toHaveBeenCalled();
    expect(second.disconnect).toHaveBeenCalled();
  });

  it("leaves other users' admin sockets and player sockets connected", async () => {
    game.sessionService.validate.mockResolvedValueOnce({
      user: TEST_MODERATOR_USER,
    });
    const moderator = await game.connectAdmin();
    const player = await game.connectPlayer();

    game.gateway.disconnectUser(TEST_ADMIN_USER.id);

    expect(moderator.disconnect).not.toHaveBeenCalled();
    expect(player.disconnect).not.toHaveBeenCalled();
  });
});
