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

describe('Early answer reveal session setting', () => {
  const harness = setupRealStoreGatewayTest();

  function update(game: RealStoreGateway, earlyAnswerReveal: boolean) {
    return game.inRequestContext(() =>
      game.gameState.updateSessionSettings(game.joinCode, {
        earlyAnswerReveal,
      }),
    );
  }

  function revealOf(game: RealStoreGateway) {
    return game.gameState.getSnapshot(game.joinCode).settings.earlyAnswerReveal;
  }

  it('is off by default and can be turned on in the lobby', async () => {
    const game = await harness.createGateway();
    expect(revealOf(game)).toBe(false);

    await update(game, true);

    expect(revealOf(game)).toBe(true);
  });

  it('is refused for a quickfire quiz', async () => {
    const game = await harness.createGateway({ quickfire: true });

    await expect(update(game, true)).rejects.toThrow(
      SessionSettingsInvalidError,
    );
  });

  it('is refused once the quiz has started', async () => {
    const game = await harness.createGateway();
    await game.act('START_QUIZ');

    await expect(update(game, true)).rejects.toThrow(
      SessionSettingsUpdateBlockedError,
    );
  });
});

describe('Versus session setting', () => {
  const harness = setupRealStoreGatewayTest();
  const sides = [
    { id: 'law', name: 'Law' },
    { id: 'eng', name: 'Engineering' },
  ];

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

  it('is off with no sides for a new session', async () => {
    const game = await harness.createGateway();

    expect(settingsOf(game)).toMatchObject({
      versusEnabled: false,
      versusSides: [],
    });
  });

  it('can be turned on with sides in the lobby, and a rename keeps the id', async () => {
    const game = await harness.createGateway();

    await update(game, { versusEnabled: true, versusSides: sides });
    await update(game, {
      versusSides: [{ id: 'law', name: 'Faculty of Law' }, sides[1]],
    });

    expect(settingsOf(game).versusSides[0]).toEqual({
      id: 'law',
      name: 'Faculty of Law',
    });
  });

  it('is refused with fewer than 2 sides, whether the patch names one setting or both', async () => {
    const game = await harness.createGateway();

    await expect(update(game, { versusEnabled: true })).rejects.toThrow(
      SessionSettingsInvalidError,
    );
    await expect(
      update(game, { versusEnabled: true, versusSides: [sides[0]] }),
    ).rejects.toThrow(SessionSettingsInvalidError);
    expect(settingsOf(game).versusEnabled).toBe(false);
  });

  it('refuses names that differ only by case', async () => {
    const game = await harness.createGateway();

    await expect(
      update(game, {
        versusEnabled: true,
        versusSides: [sides[0], { id: 'x', name: 'LAW ' }],
      }),
    ).rejects.toThrow(SessionSettingsInvalidError);
  });

  it('is refused for a quickfire quiz', async () => {
    const game = await harness.createGateway({ quickfire: true });

    await expect(
      update(game, { versusEnabled: true, versusSides: sides }),
    ).rejects.toThrow(SessionSettingsInvalidError);
  });

  it('is refused once the quiz has started', async () => {
    const game = await harness.createGateway({
      settings: { versusEnabled: true, versusSides: sides },
    });
    await game.act('START_QUIZ');

    await expect(update(game, { versusEnabled: false })).rejects.toThrow(
      SessionSettingsUpdateBlockedError,
    );
  });

  it('reads a stored settings JSON without the fields as off', async () => {
    const game = await harness.createGateway();
    const legacySettings: Partial<typeof DEFAULT_SESSION_SETTINGS> = {
      ...DEFAULT_SESSION_SETTINGS,
    };
    delete legacySettings.versusEnabled;
    delete legacySettings.versusSides;
    const em = game.orm.em.fork();
    const row = await em.findOneOrFail(GameSession, {
      joinCode: game.joinCode,
    });
    row.settings = legacySettings as typeof row.settings;
    await em.flush();

    const restarted = await game.restart();

    expect(settingsOf(restarted)).toMatchObject({
      versusEnabled: false,
      versusSides: [],
    });
  });
});
