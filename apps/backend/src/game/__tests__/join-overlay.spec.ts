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
const KAHOOT_TIMER_SECONDS = 30;
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
      expect(covered.screen).toEqual({ kind: 'join_overlay' });
      expect(covered.screenKey).toBe('join_overlay');
      expect(adminView().onAirScreen).toEqual({ kind: 'join_overlay' });

      await game.act('TOGGLE_JOIN_OVERLAY');
      expect(displayView().screen).toEqual(before.screen);
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

  describe('with the Move plan', () => {
    beforeEach(async () => {
      await actAll(['START_QUIZ', 'ADVANCE', 'ADVANCE']);
    });

    function position() {
      const { status, roundIndex, questionIndex, revealIndex } =
        adminView().progress;
      return { status, roundIndex, questionIndex, revealIndex };
    }

    it('hides the overlay on Advance without moving the quiz, then the next Advance moves it', async () => {
      const before = position();
      await game.act('TOGGLE_JOIN_OVERLAY');
      expect(adminView().advanceStep).toBe('hide_join_overlay');

      await game.act('ADVANCE');

      expect(adminView().progress.isJoinOverlayVisible).toBe(false);
      expect(position()).toEqual(before);
      await game.act('ADVANCE');
      expect(position()).not.toEqual(before);
    });

    it('hides the overlay on Previous instead of refusing it, then the next Previous moves the quiz', async () => {
      const before = position();
      await game.act('TOGGLE_JOIN_OVERLAY');
      expect(adminView().previousState).toBe('available');

      await game.act('PREVIOUS');

      expect(adminView().progress.isJoinOverlayVisible).toBe(false);
      expect(position()).toEqual(before);
      await game.act('PREVIOUS');
      expect(position()).not.toEqual(before);
    });

    it('hides the overlay on the rules, and the next Previous lands on the lobby', async () => {
      await game.act('TOGGLE_JOIN_OVERLAY');
      await game.act('PREVIOUS');
      await game.act('PREVIOUS');
      await game.act('PREVIOUS'); // back on the rules
      expect(adminView().progress.status).toBe('rules');
      await game.act('TOGGLE_JOIN_OVERLAY');

      await game.act('PREVIOUS');

      expect(adminView().progress.isJoinOverlayVisible).toBe(false);
      expect(adminView().progress.status).toBe('rules');

      await game.act('PREVIOUS');

      expect(adminView().progress.status).toBe('lobby');
      expect(adminView().progress.isJoinOverlayVisible).toBe(false);
    });

    it('tells the presenter the next press hides the overlay', async () => {
      await game.act('TOGGLE_JOIN_OVERLAY');

      const { nextScreen } = game.gameState.getPresenterContext(game.joinCode);

      expect(nextScreen?.body).toBe('Hides the join overlay');
    });
  });

  describe('against the leaderboard', () => {
    beforeEach(async () => {
      await actAll(['START_QUIZ', 'ADVANCE']);
    });

    it('turns the leaderboard off when the overlay is shown', async () => {
      await actAll(['TOGGLE_LEADERBOARD', 'ADVANCE']);
      expect(displayView().screen).toMatchObject({
        kind: 'leaderboard',
        revealCount: 1,
      });

      await game.act('TOGGLE_JOIN_OVERLAY');

      expect(adminView().progress.isLeaderboardVisible).toBe(false);
      expect(adminView().progress.isJoinOverlayVisible).toBe(true);
      expect(displayView().screen).toEqual({ kind: 'join_overlay' });
    });

    it('turns the overlay off when the leaderboard is shown', async () => {
      await game.act('TOGGLE_JOIN_OVERLAY');

      await game.act('TOGGLE_LEADERBOARD');

      expect(adminView().progress.isLeaderboardVisible).toBe(true);
      expect(adminView().progress.isJoinOverlayVisible).toBe(false);
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

describe('GameGateway — TOGGLE_JOIN_OVERLAY under a kahoot countdown', () => {
  const harness = setupRealStoreGatewayTest();

  afterEach(() => {
    restoreClock();
  });

  it('keeps the kahoot countdown and phase timers running across show and hide', async () => {
    freezeClockAt(FROZEN_NOW);
    const game = await harness.createGateway({
      kahootMode: true,
      settings: { kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS },
    });
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
    const opened = await game.act('ADVANCE'); // -> question_open q0, countdown armed
    const readDisplay = () =>
      game.gameState.getView(game.joinCode, SOCKET_ROOMS.DISPLAY);
    const endsAt = readDisplay().kahootQuestionEndsAt;
    expect(endsAt).not.toBeNull();

    advanceClockBy(CLOCK_STEP_MS);
    const shown = await game.act('TOGGLE_JOIN_OVERLAY');
    expect(readDisplay().kahootQuestionEndsAt).toBe(endsAt);
    advanceClockBy(CLOCK_STEP_MS);
    const hidden = await game.act('TOGGLE_JOIN_OVERLAY');
    expect(readDisplay().kahootQuestionEndsAt).toBe(endsAt);

    for (const after of [shown, hidden]) {
      expect(after.phaseStartedAt).toBe(opened.phaseStartedAt);
      expect(after.phaseElapsedMs).toBe(opened.phaseElapsedMs);
    }
  });
});
