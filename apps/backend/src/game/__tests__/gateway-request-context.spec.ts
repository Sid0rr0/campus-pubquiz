import { RequestContext } from '@mikro-orm/core';
import { asSocket } from '@/game/__tests__/test-utils';
import { setupRealStoreGatewayTest } from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — request context', () => {
  const harness = setupRealStoreGatewayTest();

  it('runs a socket event inside its own MikroORM request context', async () => {
    const game = await harness.createGateway();
    const admin = await game.connectAdmin();
    const seen: unknown[] = [];
    const original = game.gameState.applyAdminAction.bind(game.gameState);
    jest
      .spyOn(game.gameState, 'applyAdminAction')
      .mockImplementation((...args) => {
        seen.push(RequestContext.getEntityManager());
        return original(...args);
      });

    expect(RequestContext.getEntityManager()).toBeUndefined();
    await game.gateway.handleAdminAction(asSocket(admin), {
      action: 'START_QUIZ',
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeDefined();
  });
});
