import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { QuizDraft, QuizSummary } from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import type { GameGateway } from '@/game/game.gateway';
import type { GameStateService } from '@/game/state/game-state.service';
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
    update: jest.fn(),
  };
  const gameState = {
    getActiveQuizId: jest.fn().mockReturnValue(1),
    listSessions: jest.fn().mockReturnValue([]),
    getShownOrInProgressQuestionIds: jest.fn().mockReturnValue([]),
  };
  const gameGateway = {
    notifyQuizEdited: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new QuizController(
    quizService as unknown as QuizService,
    gameState as unknown as GameStateService,
    gameGateway as unknown as GameGateway,
  );
  return { controller, quizService, gameState, gameGateway };
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
      { id: 1, title: 'Campus Pub Quiz Night', rounds: [] },
      { id: 2, title: 'Imported Quiz', rounds: [] },
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
      { id: 1, title: 'Campus Pub Quiz Night', rounds: [] },
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

    it('attaches lockedQuestionIds when a session is live on this quiz', async () => {
      const { controller, quizService, gameState } = makeController();
      const draft: QuizDraft = { id: 1, title: 'Trivia Night', rounds: [] };
      quizService.findDraftById.mockResolvedValue(draft);
      gameState.listSessions.mockReturnValue([
        {
          joinCode: 'ABCDEF',
          quizId: 1,
          status: 'question_open',
          teamCount: 2,
        },
      ]);
      gameState.getShownOrInProgressQuestionIds.mockReturnValue([5, 6]);

      await expect(controller.findById(1)).resolves.toEqual({
        ...draft,
        liveEdit: { lockedQuestionIds: [5, 6] },
      });
    });

    it('omits liveEdit when the only sessions on this quiz are lobby/ended', async () => {
      const { controller, quizService, gameState } = makeController();
      const draft: QuizDraft = { id: 1, title: 'Trivia Night', rounds: [] };
      quizService.findDraftById.mockResolvedValue(draft);
      gameState.listSessions.mockReturnValue([
        { joinCode: 'ABCDEF', quizId: 1, status: 'lobby', teamCount: 0 },
      ]);

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
    it('returns the save result for a valid body', async () => {
      const { controller, quizService } = makeController();
      const result = { quizId: 1, roundCount: 1, questionCount: 2 };
      quizService.update.mockResolvedValue(result);

      await expect(
        controller.update(1, { title: 'Trivia Night', rounds: [] }),
      ).resolves.toBe(result);
      expect(quizService.update).toHaveBeenCalledWith(1, 'Trivia Night', []);
    });

    it('maps a missing quiz to 404', async () => {
      const { controller, quizService } = makeController();
      quizService.update.mockRejectedValue(new QuizNotFoundError(999));

      await expect(
        controller.update(999, { title: 'Trivia Night', rounds: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('behaves exactly as before when no session is live on this quiz (no extra I/O)', async () => {
      const { controller, quizService, gameState, gameGateway } =
        makeController();
      gameState.listSessions.mockReturnValue([]);
      const result = { quizId: 1, roundCount: 1, questionCount: 1 };
      quizService.update.mockResolvedValue(result);

      await expect(
        controller.update(1, { title: 'Trivia Night', rounds: [] }),
      ).resolves.toBe(result);
      expect(quizService.findDraftById).not.toHaveBeenCalled();
      expect(gameGateway.notifyQuizEdited).not.toHaveBeenCalled();
    });

    it('rejects a save that edits a locked question with 409, without persisting', async () => {
      const { controller, quizService, gameState, gameGateway } =
        makeController();
      gameState.listSessions.mockReturnValue([
        {
          joinCode: 'ABCDEF',
          quizId: 1,
          status: 'question_open',
          teamCount: 2,
        },
      ]);
      gameState.getShownOrInProgressQuestionIds.mockReturnValue([10]);
      quizService.findDraftById.mockResolvedValue({
        id: 1,
        title: 'Trivia Night',
        rounds: [
          {
            title: 'Round 1',
            breakAfter: false,
            questions: [
              {
                questionId: 10,
                type: 'free_text',
                prompt: 'Original prompt',
                answer: 'Original answer',
                points: 1,
              },
            ],
          },
        ],
      });

      const promise = controller.update(1, {
        title: 'Trivia Night',
        rounds: [
          {
            title: 'Round 1',
            breakAfter: false,
            questions: [
              {
                questionId: 10,
                type: 'free_text',
                prompt: 'Edited prompt',
                answer: 'Original answer',
                points: 1,
              },
            ],
          },
        ],
      });

      await expect(promise).rejects.toThrow(ConflictException);
      await promise.catch((error: ConflictException) => {
        expect(error.getResponse()).toMatchObject({
          issues: [
            expect.objectContaining({
              roundIndex: 0,
              questionIndex: 0,
              field: 'prompt',
            }),
          ],
        });
      });
      expect(quizService.update).not.toHaveBeenCalled();
      expect(gameGateway.notifyQuizEdited).not.toHaveBeenCalled();
    });

    it('saves and notifies every live session when editing an unlocked question', async () => {
      const { controller, quizService, gameState, gameGateway } =
        makeController();
      gameState.listSessions.mockReturnValue([
        {
          joinCode: 'ABCDEF',
          quizId: 1,
          status: 'question_open',
          teamCount: 2,
        },
      ]);
      gameState.getShownOrInProgressQuestionIds.mockReturnValue([10]);
      const currentDraft: QuizDraft = {
        id: 1,
        title: 'Trivia Night',
        rounds: [
          {
            title: 'Round 1',
            breakAfter: false,
            questions: [
              {
                questionId: 10,
                type: 'free_text',
                prompt: 'Q1',
                answer: 'A1',
                points: 1,
              },
              {
                questionId: 11,
                type: 'free_text',
                prompt: 'Q2',
                answer: 'A2',
                points: 1,
              },
            ],
          },
        ],
      };
      quizService.findDraftById.mockResolvedValue(currentDraft);
      const result = { quizId: 1, roundCount: 1, questionCount: 2 };
      quizService.update.mockResolvedValue(result);

      const editedRounds = [
        {
          title: 'Round 1',
          breakAfter: false,
          questions: [
            {
              questionId: 10,
              type: 'free_text' as const,
              prompt: 'Q1',
              answer: 'A1',
              points: 1,
            },
            {
              questionId: 11,
              type: 'free_text' as const,
              prompt: 'Corrected Q2',
              answer: 'Corrected A2',
              points: 1,
            },
          ],
        },
      ];

      await expect(
        controller.update(1, { title: 'Trivia Night', rounds: editedRounds }),
      ).resolves.toBe(result);
      expect(quizService.update).toHaveBeenCalledWith(
        1,
        'Trivia Night',
        editedRounds,
      );
      expect(gameGateway.notifyQuizEdited).toHaveBeenCalledWith('ABCDEF');
    });
  });
});
