import { Logger } from '@nestjs/common';
import { asSocket } from '@/game/__tests__/test-utils';
import { setupRealStoreGatewayTest } from '@/game/__tests__/real-store-test-utils';
import { GENERIC_ERROR_MESSAGE } from '@/game/socket/acknowledge.util';

describe('GameGateway — an unexpected failure during an event', () => {
  const harness = setupRealStoreGatewayTest();

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('arrives as a refusal with its message for an admin action', async () => {
    const game = await harness.createGateway();
    const admin = await game.connectAdmin();
    jest
      .spyOn(game.liveChanges.moveCommitter, 'commit')
      .mockRejectedValueOnce(new Error('database is down'));

    const ack = await game.gateway.handleAdminAction(asSocket(admin), {
      action: 'START_QUIZ',
    });

    expect(ack).toEqual({ success: false, error: 'database is down' });
  });

  it('gets the generic error for an event without a fallback refusal', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const admin = await game.connectAdmin();
    const [{ teamId }] = game.teams;
    jest
      .spyOn(game.liveChanges.bonus, 'award')
      .mockRejectedValueOnce(new Error('database is down'));

    const ack = await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId,
      category: 'shot',
      points: 1,
    });

    expect(ack).toEqual({ success: false, error: GENERIC_ERROR_MESSAGE });
  });
});
