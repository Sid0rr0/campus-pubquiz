import {
  DEFAULT_SESSION_SETTINGS,
  type SessionSettings,
} from '@campus-pubquiz/types';
import { SessionSettingsUpdateBlockedError } from '@/game/state/game-state.service';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameStateService — updateSessionSettings', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway();
  });

  function update(partial: Partial<SessionSettings>) {
    return game.inRequestContext(() =>
      game.gameState.updateSessionSettings(game.joinCode, partial),
    );
  }

  function settings() {
    return game.gameState.getSnapshot(game.joinCode).settings;
  }

  it('exposes the default settings before any update', () => {
    expect(settings()).toEqual(DEFAULT_SESSION_SETTINGS);
  });

  it('merges a partial over the current settings while in the lobby', async () => {
    await update({ lockGraceSeconds: 15 });

    expect(settings()).toEqual({
      ...DEFAULT_SESSION_SETTINGS,
      lockGraceSeconds: 15,
    });
  });

  it('persists the merged settings, so a restart keeps them', async () => {
    await update({ autoplayMedia: false });

    const restarted = await game.restart();

    expect(restarted.gameState.getSnapshot(game.joinCode).settings).toEqual({
      ...DEFAULT_SESSION_SETTINGS,
      autoplayMedia: false,
    });
  });

  it('leaves fields not present in the partial untouched across successive updates', async () => {
    await update({ lockGraceSeconds: 15 });
    await update({ autoplayMedia: false });

    expect(settings()).toEqual({
      ...DEFAULT_SESSION_SETTINGS,
      lockGraceSeconds: 15,
      autoplayMedia: false,
    });
  });

  it('rejects updating settings once the quiz has started', async () => {
    await game.act('START_QUIZ');

    await expect(update({ lockGraceSeconds: 15 })).rejects.toThrow(
      SessionSettingsUpdateBlockedError,
    );
    expect(settings()).toEqual(DEFAULT_SESSION_SETTINGS);
  });

  it('merges and persists kahootQuestionTimerSeconds', async () => {
    await update({ kahootQuestionTimerSeconds: 45 });

    expect(settings()).toEqual({
      ...DEFAULT_SESSION_SETTINGS,
      kahootQuestionTimerSeconds: 45,
    });
    const restarted = await game.restart();
    expect(
      restarted.gameState.getSnapshot(game.joinCode).settings
        .kahootQuestionTimerSeconds,
    ).toBe(45);
  });

  it('round-trips a null kahootQuestionTimerSeconds without being stripped', async () => {
    await update({ kahootQuestionTimerSeconds: 45 });
    await update({ kahootQuestionTimerSeconds: null });

    expect(settings().kahootQuestionTimerSeconds).toBe(null);
    const restarted = await game.restart();
    expect(
      restarted.gameState.getSnapshot(game.joinCode).settings
        .kahootQuestionTimerSeconds,
    ).toBe(null);
  });

  it('reflects the updated settings in the snapshot', async () => {
    await update({ rules: ['Just one rule.'] });

    expect((await game.snapshot()).settings.rules).toEqual(['Just one rule.']);
  });
});
