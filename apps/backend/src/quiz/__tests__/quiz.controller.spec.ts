import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  LiveEditFrontier,
  QuizDraft,
  QuizSummary,
} from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import type { LiveEditService } from '@/game/live-edit/live-edit.service';
import type { GameStateService } from '@/game/state/game-state.service';
import { QuizLiveEditBlockedError } from '@/quiz/live-edit-guard';
import { QuizController } from '@/quiz/quiz.controller';
import {
  QuizDraftInvalidError,
  QuizNotFoundError,
  type QuizService,
} from '@/quiz/quiz.service';

function makeController() {
  const quizService = {
    list: jest.fn(),
    findDraftById: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };
  const gameState = { getActiveQuizId: jest.fn().mockReturnValue(1) };
  const liveEdit = {
    getFrontier: jest.fn().mockReturnValue(null),
    hasLiveSession: jest.fn().mockReturnValue(false),
    save: jest.fn(),
  };
  const controller = new QuizController(
    quizService as unknown as QuizService,
    gameState as unknown as GameStateService,
    liveEdit as unknown as LiveEditService,
  );
  return { controller, quizService, gameState, liveEdit };
}

describe('QuizController', () => {
  it('is protected by SessionGuard + RolesGuard', () => {
    const guards = Reflect.getMetadata('__guards__', QuizController) as
      | unknown[]
      | undefined;

    expect(guards).toContain(SessionGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('returns the active quiz id alongside the quiz list', async () => {
    const { controller, quizService, gameState } = makeController();
    const quizzes: QuizSummary[] = [
      {
        id: 1,
        title: 'Campus Pub Quiz Night',
        updatedAt: '2026-09-16T00:00:00.000Z',
        rounds: [],
      },
      {
        id: 2,
        title: 'Imported Quiz',
        updatedAt: '2026-09-16T00:00:00.000Z',
        rounds: [],
      },
    ];
    quizService.list.mockResolvedValue(quizzes);
    gameState.getActiveQuizId.mockReturnValue(1);

    await expect(controller.list('ABCDEF')).resolves.toEqual({
      activeQuizId: 1,
      quizzes,
    });
  });

  it('returns a null active quiz id when no joinCode is given', async () => {
    const { controller, quizService, gameState } = makeController();
    const quizzes: QuizSummary[] = [
      {
        id: 1,
        title: 'Campus Pub Quiz Night',
        updatedAt: '2026-09-16T00:00:00.000Z',
        rounds: [],
      },
    ];
    quizService.list.mockResolvedValue(quizzes);

    await expect(controller.list()).resolves.toEqual({
      activeQuizId: null,
      quizzes,
    });
    expect(gameState.getActiveQuizId).not.toHaveBeenCalled();
  });

  describe('findById', () => {
    it('returns the draft for an existing quiz', async () => {
      const { controller, quizService } = makeController();
      const draft: QuizDraft = { id: 1, title: 'Trivia Night', rounds: [] };
      quizService.findDraftById.mockResolvedValue(draft);

      await expect(controller.findById(1)).resolves.toBe(draft);
      expect(quizService.findDraftById).toHaveBeenCalledWith(1);
    });

    it('maps a missing quiz to 404', async () => {
      const { controller, quizService } = makeController();
      quizService.findDraftById.mockResolvedValue(null);

      await expect(controller.findById(999)).rejects.toThrow(NotFoundException);
    });

    it('attaches the live-edit frontier the Live edit module reports', async () => {
      const { controller, quizService, liveEdit } = makeController();
      const draft: QuizDraft = { id: 1, title: 'Trivia Night', rounds: [] };
      const frontier: LiveEditFrontier = {
        openedQuestionIds: [5, 6],
        currentRoundIndex: 1,
        hasCurrentBlockStartedLocking: true,
      };
      quizService.findDraftById.mockResolvedValue(draft);
      liveEdit.getFrontier.mockReturnValue(frontier);

      await expect(controller.findById(1)).resolves.toEqual({
        ...draft,
        liveEdit: frontier,
      });
      expect(liveEdit.getFrontier).toHaveBeenCalledWith(1);
    });

    it('omits liveEdit when no session is live on the quiz', async () => {
      const { controller, quizService } = makeController();
      const draft: QuizDraft = { id: 1, title: 'Trivia Night', rounds: [] };
      quizService.findDraftById.mockResolvedValue(draft);

      await expect(controller.findById(1)).resolves.toBe(draft);
    });
  });

  describe('create', () => {
    it('returns the save result for a valid body', async () => {
      const { controller, quizService } = makeController();
      const result = { quizId: 1, roundCount: 1, questionCount: 2 };
      quizService.create.mockResolvedValue(result);

      await expect(
        controller.create({ title: 'Trivia Night', rounds: [] }),
      ).resolves.toBe(result);
      expect(quizService.create).toHaveBeenCalledWith('Trivia Night', []);
    });

    it('maps an invalid draft to 422 with the issues attached', async () => {
      const { controller, quizService } = makeController();
      const issues = [
        {
          roundIndex: -1,
          questionIndex: null,
          field: 'rounds',
          message: 'Quiz needs at least one round',
        },
      ];
      quizService.create.mockRejectedValue(new QuizDraftInvalidError(issues));

      const promise = controller.create({ title: 'Trivia Night', rounds: [] });

      await expect(promise).rejects.toThrow(UnprocessableEntityException);
      await promise.catch((error: UnprocessableEntityException) => {
        expect(error.getResponse()).toMatchObject({ issues });
      });
    });
  });

  describe('update', () => {
    const body = { title: 'Trivia Night', rounds: [] };

    it('returns the Live edit module’s save result', async () => {
      const { controller, liveEdit } = makeController();
      const result = { quizId: 1, roundCount: 1, questionCount: 2 };
      liveEdit.save.mockResolvedValue(result);

      await expect(controller.update(1, body)).resolves.toBe(result);
      expect(liveEdit.save).toHaveBeenCalledWith(1, body);
    });

    it('maps a missing quiz to 404', async () => {
      const { controller, liveEdit } = makeController();
      liveEdit.save.mockRejectedValue(new QuizNotFoundError(999));

      await expect(controller.update(999, body)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('maps an invalid draft to 422 with the issues attached', async () => {
      const { controller, liveEdit } = makeController();
      const issues = [
        {
          roundIndex: -1,
          questionIndex: null,
          field: 'rounds',
          message: 'Quiz needs at least one round',
        },
      ];
      liveEdit.save.mockRejectedValue(new QuizDraftInvalidError(issues));

      const promise = controller.update(1, body);

      await expect(promise).rejects.toThrow(UnprocessableEntityException);
      await promise.catch((error: UnprocessableEntityException) => {
        expect(error.getResponse()).toMatchObject({ issues });
      });
    });

    it('maps a save refused by the live-edit frontier to 409 with the issues attached', async () => {
      const { controller, liveEdit } = makeController();
      const issues = [
        {
          roundIndex: 0,
          questionIndex: 1,
          field: 'questions',
          message: 'Q2 is already open — add it after the last opened one',
        },
      ];
      liveEdit.save.mockRejectedValue(new QuizLiveEditBlockedError(issues));

      const promise = controller.update(1, body);

      await expect(promise).rejects.toThrow(ConflictException);
      await promise.catch((error: ConflictException) => {
        expect(error.getResponse()).toMatchObject({ issues });
      });
    });
  });

  describe('remove', () => {
    it('is admin-only', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method -- inspected for metadata only, never invoked
      const removeHandler = QuizController.prototype.remove;
      const roles = Reflect.getMetadata('roles', removeHandler) as
        | unknown[]
        | undefined;
      expect(roles).toEqual(['admin']);
    });

    it('deletes the quiz when no session is live on it', async () => {
      const { controller, quizService } = makeController();
      quizService.remove.mockResolvedValue(undefined);

      await controller.remove(1);

      expect(quizService.remove).toHaveBeenCalledWith(1);
    });

    it('rejects with 409 when a live session is running on this quiz', async () => {
      const { controller, quizService, liveEdit } = makeController();
      liveEdit.hasLiveSession.mockReturnValue(true);

      await expect(controller.remove(1)).rejects.toThrow(ConflictException);
      expect(quizService.remove).not.toHaveBeenCalled();
    });

    it('maps a missing quiz to 404', async () => {
      const { controller, quizService } = makeController();
      quizService.remove.mockRejectedValue(new QuizNotFoundError(999));

      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
