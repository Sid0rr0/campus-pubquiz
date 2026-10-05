import { Logger } from '@nestjs/common';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameStateService — committing a move', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      rounds: [
        {
          title: 'Round 1',
          breakAfter: true,
          questions: [{ type: 'free_text', prompt: 'Q1', answer: 'A1' }],
        },
      ],
    });
    await game.act('START_QUIZ');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when the progress cannot be saved', () => {
    it('refuses the press and leaves the next snapshot unchanged', async () => {
      // Arrange
      const before = await game.snapshot();
      jest
        .spyOn(game.progressRepository, 'save')
        .mockRejectedValueOnce(new Error('database is down'));

      // Act
      const press = game.act('ADVANCE');

      // Assert
      await expect(press).rejects.toBeDefined();
      expect(await game.snapshot()).toEqual(before);
    });

    it('lets the same press through once saving works again', async () => {
      // Arrange
      const before = await game.snapshot();
      jest
        .spyOn(game.progressRepository, 'save')
        .mockRejectedValueOnce(new Error('database is down'));
      await expect(game.act('ADVANCE')).rejects.toBeDefined();

      // Act
      const after = await game.act('ADVANCE');

      // Assert
      expect(after.progress.status).not.toBe(before.progress.status);
    });
  });

  describe('when the standings cannot be read after the progress is saved', () => {
    let logError: jest.SpyInstance;

    beforeEach(() => {
      logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      jest
        .spyOn(game.standingsService, 'leaderboard')
        .mockRejectedValueOnce(new Error('database is down'));
    });

    it('carries the press out on the saved status and logs the failure', async () => {
      // Act
      const after = await game.act('ADVANCE');

      // Assert
      expect(after.progress.status).toBe('round_intro');
      expect((await game.snapshot()).progress.status).toBe('round_intro');
      expect(logError).toHaveBeenCalledTimes(1);
    });

    it('plans the next press from the saved status', async () => {
      // Arrange
      await game.act('ADVANCE');

      // Act
      const after = await game.act('ADVANCE');

      // Assert
      expect(after.progress.status).toBe('question_open');
    });

    it('catches the leaderboard up on the next write', async () => {
      // Arrange
      const [{ teamId }] = game.teams;
      await game.act('ADVANCE');

      // Act
      const after = await game.act('ADVANCE');

      // Assert
      expect(after.leaderboard).toEqual([
        expect.objectContaining({ teamId, totalPoints: 0 }),
      ]);
    });
  });

  describe('the outcome of a press', () => {
    it('names every connected team for a re-sync when the reveal starts', async () => {
      // Arrange
      const [{ teamId, socket }] = game.teams;
      await game.act('ADVANCE'); // -> round_intro
      await game.act('ADVANCE'); // -> question_open
      await game.act('ADVANCE'); // -> locking
      await game.act('ADVANCE'); // -> break_intro

      // Act
      const outcome = await game.inRequestContext(() =>
        game.gameState.applyAdminAction(game.joinCode, 'ADVANCE'),
      );

      // Assert
      expect(outcome.teamSyncs).toEqual([{ teamId, socketId: socket.id }]);
    });

    it('names nobody for a press that does not enter the reveal', async () => {
      // Act
      const outcome = await game.inRequestContext(() =>
        game.gameState.applyAdminAction(game.joinCode, 'ADVANCE'),
      );

      // Assert
      expect(outcome.teamSyncs).toEqual([]);
    });
  });

  describe('the presenter preview, a dry run of the next press', () => {
    it('saves nothing and leaves the session where it was', async () => {
      // Arrange
      const before = await game.snapshot();
      const save = jest.spyOn(game.progressRepository, 'save');

      // Act
      const { nextScreen } = game.gameState.getPresenterContext(game.joinCode);

      // Assert
      expect(nextScreen).not.toBeNull();
      expect(save).not.toHaveBeenCalled();
      expect(await game.snapshot()).toEqual(before);
    });
  });
});
