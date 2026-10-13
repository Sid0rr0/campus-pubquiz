import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — PREVIOUS from the rules goes back to the lobby', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  function displayView() {
    return game.gameState.getView(game.joinCode, SOCKET_ROOMS.DISPLAY);
  }

  function adminView() {
    return game.gameState.getView(game.joinCode, SOCKET_ROOMS.ADMIN);
  }

  function playersView() {
    return game.gameState.getView(game.joinCode, SOCKET_ROOMS.PLAYERS);
  }

  beforeEach(async () => {
    game = await harness.createGateway();
  });

  it('shows the lobby screens again, unlocks lobby-only settings and lets Start quiz move to the rules again', async () => {
    await game.act('START_QUIZ');
    expect(displayView().progress.status).toBe('rules');
    expect(adminView().previousState).toBe('available');

    await game.act('PREVIOUS');

    expect(displayView().progress.status).toBe('lobby');
    expect(displayView().onAirScreen).toEqual({ kind: 'lobby' });
    expect(playersView().progress.status).toBe('lobby');
    expect(playersView().phoneScreen).toEqual({ kind: 'lobby' });
    await expect(
      game.inRequestContext(() =>
        game.gameState.updateSessionSettings(game.joinCode, {
          collectFeedback: false,
        }),
      ),
    ).resolves.not.toThrow();

    await game.act('START_QUIZ');
    expect(displayView().progress.status).toBe('rules');
  });

  it('announces Start quiz as the next press in the lobby after going back', async () => {
    await game.act('START_QUIZ');
    await game.act('PREVIOUS');

    const { currentScreen, nextScreen } = game.gameState.getPresenterContext(
      game.joinCode,
    );
    expect(currentScreen?.heading).toBe('Lobby');
    expect(nextScreen?.heading).toBe('Rules');
    expect(adminView().previousState).toBe('unavailable');
    await expect(game.act('PREVIOUS')).rejects.toThrow();
    await expect(game.act('ADVANCE')).rejects.toThrow();
  });

  it('goes back to the rules, not the lobby, from round_overview', async () => {
    await game.inRequestContext(() =>
      game.gameState.updateSessionSettings(game.joinCode, {
        showRoundOverview: true,
      }),
    );
    await game.act('START_QUIZ');
    await game.act('ADVANCE');
    expect(adminView().progress.status).toBe('round_overview');

    await game.act('PREVIOUS');

    expect(adminView().progress.status).toBe('rules');
  });

  it('does not reach the lobby from the first round intro onward', async () => {
    await game.act('START_QUIZ');
    await game.act('ADVANCE');
    expect(adminView().progress.status).toBe('round_intro');

    await game.act('PREVIOUS');
    expect(adminView().progress.status).toBe('rules');

    await game.act('ADVANCE');
    await game.act('ADVANCE');
    expect(adminView().progress.status).toBe('question_open');
    await game.act('PREVIOUS');
    expect(adminView().progress.status).toBe('round_intro');
  });
});
