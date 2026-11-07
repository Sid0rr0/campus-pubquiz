import { SessionSettingsInvalidError } from '@/game/state/game-state.service';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('A quickfire session drops jokers, power-ups, coins and leagues', () => {
  const harness = setupRealStoreGatewayTest();

  function update(
    game: RealStoreGateway,
    partial: Parameters<
      RealStoreGateway['gameState']['updateSessionSettings']
    >[1],
    leagueIds?: number[],
  ) {
    return game.inRequestContext(() =>
      game.gameState.updateSessionSettings(game.joinCode, partial, leagueIds),
    );
  }

  it.each([
    ['jokers', { jokersEnabled: true, showRoundOverview: true }],
    ['power-ups', { powerUpsEnabled: true }],
    ['starting coins', { startingCoins: 5 }],
  ])('refuses %s in the lobby settings', async (_name, partial) => {
    const game = await harness.createGateway({ quickfire: true });

    await expect(update(game, partial)).rejects.toThrow(
      SessionSettingsInvalidError,
    );
  });

  it('refuses a league and still takes the question timer', async () => {
    const game = await harness.createGateway({ quickfire: true });

    await expect(update(game, {}, [1])).rejects.toThrow(
      SessionSettingsInvalidError,
    );
    await update(game, { quickfireQuestionTimerSeconds: 20 });
    expect(
      game.gameState.getSnapshot(game.joinCode).settings
        .quickfireQuestionTimerSeconds,
    ).toBe(20);
  });

  it('refuses a coin award even when the session still has power-ups on', async () => {
    const game = await harness.createGateway({
      quickfire: true,
      teamNames: ['The Quizzards'],
      settings: { powerUpsEnabled: true },
    });
    const admin = await game.connectAdmin();

    await expect(
      game.gateway.handleAwardBonus(asSocket(admin), {
        teamId: game.teams[0].teamId,
        category: 'custom',
        points: 0,
        coins: 2,
        reason: 'Nice',
      }),
    ).resolves.toMatchObject({ success: false });
  });
});
