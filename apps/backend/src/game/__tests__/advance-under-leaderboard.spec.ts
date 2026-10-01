import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type AdminStatePayload,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  freezeClockAt,
  restoreClock,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const KAHOOT_TIMER_SECONDS = 30;
const FROZEN_NOW = '2024-01-01T00:00:00.000Z';

describe('GameGateway — ADVANCE and PREVIOUS while the leaderboard is up', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  function adminView() {
    return game.gameState.getView(game.joinCode, SOCKET_ROOMS.ADMIN);
  }

  function underneath() {
    const { status, roundIndex, questionIndex, revealIndex } =
      adminView().progress;
    return { status, roundIndex, questionIndex, revealIndex };
  }

  describe('on a title card with two tied teams', () => {
    beforeEach(async () => {
      game = await harness.createGateway({
        teamNames: ['Team A', 'Team B'],
      });
      await game.act('START_QUIZ');
      await game.act('ADVANCE'); // -> round_intro
      await game.act('TOGGLE_LEADERBOARD');
    });

    it('reveals the one tied rank, then hides the board, never moving the quiz underneath', async () => {
      const before = underneath();
      expect(adminView().advanceStep).toBe('reveal_next_rank');

      await game.act('ADVANCE');
      expect(adminView()).toMatchObject({
        leaderboardRevealCount: 1,
        advanceStep: 'hide_leaderboard',
      });
      expect(adminView().progress.isLeaderboardVisible).toBe(true);
      expect(underneath()).toEqual(before);

      await game.act('ADVANCE');
      expect(adminView().progress.isLeaderboardVisible).toBe(false);
      expect(underneath()).toEqual(before);
    });

    it('announces and rejects PREVIOUS while the board covers the screen', async () => {
      const before = underneath();

      expect(adminView().previousState).toBe('covered_by_leaderboard');
      await expect(game.act('PREVIOUS')).rejects.toThrow();

      expect(underneath()).toEqual(before);
      expect(adminView().progress.isLeaderboardVisible).toBe(true);
    });

    it('announces PREVIOUS as available again once the board is hidden', async () => {
      await game.act('TOGGLE_LEADERBOARD');

      expect(adminView().previousState).toBe('available');
    });

    it('still lets clients that send REVEAL_NEXT_TEAM and TOGGLE_LEADERBOARD drive the board', async () => {
      await game.act('REVEAL_NEXT_TEAM');
      expect(adminView().leaderboardRevealCount).toBe(1);

      await game.act('TOGGLE_LEADERBOARD');
      expect(adminView().progress.isLeaderboardVisible).toBe(false);
    });

    it('sends a reconnecting admin the same step and Previous state in the full view', async () => {
      await game.act('ADVANCE');

      const admin = await game.connectAdmin();

      expect(admin.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.STATE_SYNC,
        expect.objectContaining<Partial<AdminStatePayload>>({
          advanceStep: 'hide_leaderboard',
          previousState: 'covered_by_leaderboard',
        }),
      );
    });

    it('updates the announced step when a bonus adds a rank while the board is up', async () => {
      await game.act('ADVANCE');
      expect(adminView().advanceStep).toBe('hide_leaderboard');

      await game.gateway.handleAwardBonus(asSocket(await game.connectAdmin()), {
        teamId: game.teams[0].teamId,
        category: 'shot',
        points: 1,
      });

      expect(adminView().advanceStep).toBe('reveal_next_rank');
    });
  });

  describe('in the lobby, where nothing waits underneath', () => {
    it('blocks Advance once every rank is shown instead of offering a hide that goes nowhere', async () => {
      game = await harness.createGateway({ teamNames: ['Team A'] });
      await game.act('TOGGLE_LEADERBOARD');
      await game.act('ADVANCE');

      expect(adminView().advanceStep).toBe('none');
      expect(adminView().previousState).toBe('unavailable');
      await expect(game.act('ADVANCE')).rejects.toThrow();
      expect(adminView().progress.isLeaderboardVisible).toBe(true);
    });
  });

  describe('between kahoot questions', () => {
    beforeEach(async () => {
      freezeClockAt(FROZEN_NOW);
      game = await harness.createGateway({
        kahootMode: true,
        settings: { kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS },
        teamNames: ['The Quizzards'],
      });
      await game.act('START_QUIZ');
      await game.act('ADVANCE'); // -> round_intro
      await game.act('ADVANCE'); // -> question_open q0
      await game.act('ADVANCE'); // -> locking
      await game.act('ADVANCE'); // -> reveal
      await game.act('ADVANCE'); // -> question_open q1 hidden behind the board
    });

    afterEach(() => {
      restoreClock();
    });

    it('hides the board with ADVANCE and arms the question timer exactly as the toggle does', async () => {
      expect(adminView().advanceStep).toBe('hide_leaderboard');
      expect(adminView().kahootQuestionEndsAt).toBeNull();

      await game.act('ADVANCE');

      expect(adminView().progress.isLeaderboardVisible).toBe(false);
      expect(adminView().kahootQuestionEndsAt).toBe(
        Date.now() + KAHOOT_TIMER_SECONDS * 1000,
      );
    });

    it('arms the same deadline when the toggle hides the board', async () => {
      await game.act('TOGGLE_LEADERBOARD');

      expect(adminView().kahootQuestionEndsAt).toBe(
        Date.now() + KAHOOT_TIMER_SECONDS * 1000,
      );
    });
  });
});
