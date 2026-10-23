import { DEFAULT_SESSION_SETTINGS } from '@campus-pubquiz/types';
import { GameSession } from '@/db/entities/game-session.entity';
import {
  SessionSettingsInvalidError,
  SessionSettingsUpdateBlockedError,
} from '@/game/state/game-state.service';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('Jokers session setting', () => {
  const harness = setupRealStoreGatewayTest();

  function settingsOf(game: RealStoreGateway) {
    return game.gameState.getSnapshot(game.joinCode).settings;
  }

  function update(
    game: RealStoreGateway,
    partial: Parameters<
      RealStoreGateway['gameState']['updateSessionSettings']
    >[1],
  ) {
    return game.inRequestContext(() =>
      game.gameState.updateSessionSettings(game.joinCode, partial),
    );
  }

  it('is off for a new session', async () => {
    const game = await harness.createGateway();

    expect(DEFAULT_SESSION_SETTINGS.jokersEnabled).toBe(false);
    expect(settingsOf(game).jokersEnabled).toBe(false);
  });

  it('can be turned on in the lobby together with the round overview', async () => {
    const game = await harness.createGateway();

    await update(game, { jokersEnabled: true, showRoundOverview: true });

    expect(settingsOf(game)).toMatchObject({
      jokersEnabled: true,
      showRoundOverview: true,
    });
  });

  it('can be turned on alone when the round overview is already on', async () => {
    const game = await harness.createGateway({
      settings: { showRoundOverview: true },
    });

    await update(game, { jokersEnabled: true });

    expect(settingsOf(game).jokersEnabled).toBe(true);
  });

  it('is refused with the round overview off, whether the patch names one setting or both', async () => {
    const game = await harness.createGateway();

    await expect(update(game, { jokersEnabled: true })).rejects.toThrow(
      SessionSettingsInvalidError,
    );
    await expect(
      update(game, { jokersEnabled: true, showRoundOverview: false }),
    ).rejects.toThrow(SessionSettingsInvalidError);
    expect(settingsOf(game).jokersEnabled).toBe(false);
  });

  it('refuses turning the round overview off while jokers are on', async () => {
    const game = await harness.createGateway({
      settings: { showRoundOverview: true, jokersEnabled: true },
    });

    await expect(update(game, { showRoundOverview: false })).rejects.toThrow(
      SessionSettingsInvalidError,
    );
    expect(settingsOf(game).showRoundOverview).toBe(true);
  });

  it('is refused once the quiz has started', async () => {
    const game = await harness.createGateway({
      settings: { showRoundOverview: true },
    });
    await game.act('START_QUIZ');

    await expect(update(game, { jokersEnabled: true })).rejects.toThrow(
      SessionSettingsUpdateBlockedError,
    );
  });

  it('reads a stored settings JSON without the field as off', async () => {
    const game = await harness.createGateway();
    const legacySettings: Partial<typeof DEFAULT_SESSION_SETTINGS> = {
      ...DEFAULT_SESSION_SETTINGS,
    };
    delete legacySettings.jokersEnabled;
    const em = game.orm.em.fork();
    const row = await em.findOneOrFail(GameSession, {
      joinCode: game.joinCode,
    });
    row.settings = legacySettings as typeof row.settings;
    await em.flush();

    const restarted = await game.restart();

    expect(settingsOf(restarted).jokersEnabled).toBe(false);
  });
});
