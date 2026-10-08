import { SOCKET_ROOMS, type GameAction } from '@campus-pubquiz/types';
import {
  TWO_ROUND_QUIZ,
  advanceClockBy,
  freezeClockAt,
  restoreClock,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const CLOCK_STEP_MS = 10_000;
const FROZEN_NOW = '2024-01-01T00:00:00.000Z';

describe('GameGateway — TOGGLE_JOIN_OVERLAY', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  function adminView() {
    return game.gameState.getView(game.joinCode, SOCKET_ROOMS.ADMIN);
  }

  function displayView() {
    return game.gameState.getView(game.joinCode, SOCKET_ROOMS.DISPLAY);
  }

  function playersView() {
    return game.gameState.getView(game.joinCode, SOCKET_ROOMS.PLAYERS);
  }

  async function actAll(actions: GameAction[]) {
    for (const action of actions) {
      await game.act(action);
    }
  }

  beforeEach(async () => {
    game = await harness.createGateway({
      rounds: TWO_ROUND_QUIZ,
      teamNames: ['Team A'],
    });
  });

  afterEach(() => {
    restoreClock();
  });

  describe('where it is allowed', () => {
    it('is refused in the lobby', async () => {
      await expect(game.act('TOGGLE_JOIN_OVERLAY')).rejects.toThrow();

      expect(adminView().progress.isJoinOverlayVisible).toBeFalsy();
    });

    it('is refused once the quiz has ended', async () => {
      await actAll(['START_QUIZ', 'END_QUIZ']);

      await expect(game.act('TOGGLE_JOIN_OVERLAY')).rejects.toThrow();
    });

    it.each([
      ['the rules', ['START_QUIZ']],
      ['a round intro', ['START_QUIZ', 'ADVANCE']],
      ['an open question', ['START_QUIZ', 'ADVANCE', 'ADVANCE']],
    ] as [string, GameAction[]][])('is accepted on %s', async (_name, walk) => {
      await actAll(walk);

      await game.act('TOGGLE_JOIN_OVERLAY');

      expect(adminView().progress.isJoinOverlayVisible).toBe(true);
    });
  });

  describe('what the screens show', () => {
    beforeEach(async () => {
      await actAll(['START_QUIZ', 'ADVANCE', 'ADVANCE']);
    });

    it('covers the display with the join overlay and restores it when toggled off', async () => {
      const before = displayView();

      await game.act('TOGGLE_JOIN_OVERLAY');
      const covered = displayView();
      expect(covered.onAirScreen).toEqual({ kind: 'join_overlay' });
      expect(covered.screenKey).toBe('join_overlay');
      expect(adminView().onAirScreen).toEqual({ kind: 'join_overlay' });

      await game.act('TOGGLE_JOIN_OVERLAY');
      expect(displayView().onAirScreen).toEqual(before.onAirScreen);
      expect(displayView().screenKey).toBe(before.screenKey);
    });

    it('leaves the quiz where it was underneath', async () => {
      const { status, roundIndex, questionIndex } = adminView().progress;

      await game.act('TOGGLE_JOIN_OVERLAY');

      expect(adminView().progress).toMatchObject({
        status,
        roundIndex,
        questionIndex,
      });
    });

    it('leaves the players phone screen unchanged', async () => {
      const before = playersView().phoneScreen;

      await game.act('TOGGLE_JOIN_OVERLAY');

      expect(playersView().phoneScreen).toEqual(before);
    });
  });

  describe('timers', () => {
    it('keeps an open question lock deadline the same across show and hide', async () => {
      freezeClockAt(FROZEN_NOW);
      await actAll([
        'START_QUIZ',
        'ADVANCE', // -> round_intro(0)
        'ADVANCE', // -> r1q1
        'ADVANCE', // -> r1q2
        'ADVANCE', // -> round_intro(1)
        'ADVANCE', // -> r2q1
        'ADVANCE', // -> r2q2 (last of the block)
        'ADVANCE', // -> locking
      ]);
      const armed = (await game.snapshot()).questionLockAt;
      expect(armed).not.toBeNull();

      advanceClockBy(CLOCK_STEP_MS);
      const shown = await game.act('TOGGLE_JOIN_OVERLAY');
      advanceClockBy(CLOCK_STEP_MS);
      const hidden = await game.act('TOGGLE_JOIN_OVERLAY');

      expect(shown.questionLockAt).toBe(armed);
      expect(hidden.questionLockAt).toBe(armed);
    });
  });

  describe('clearing', () => {
    it('is cleared by End quiz while the overlay is up', async () => {
      await actAll(['START_QUIZ', 'TOGGLE_JOIN_OVERLAY', 'END_QUIZ']);

      expect(adminView().progress.status).toBe('ended');
      expect(adminView().progress.isJoinOverlayVisible).toBe(false);
    });
  });

  describe('persistence', () => {
    it('survives a backend restart', async () => {
      await actAll(['START_QUIZ', 'TOGGLE_JOIN_OVERLAY']);

      const restarted = await game.restart();

      const snapshot = await restarted.snapshot();
      expect(snapshot.progress.isJoinOverlayVisible).toBe(true);
      expect(snapshot.onAirScreen).toEqual({ kind: 'join_overlay' });
    });
  });
});
