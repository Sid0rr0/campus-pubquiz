import { NotFoundException } from '@nestjs/common';
import type { AdminQuestionContext, AnswerView } from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { AnswerController } from '@/answer/answer.controller';
import type { AnswerService } from '@/answer/answer.service';
import type { GameStateService } from '@/game/state/game-state.service';

function makeController() {
  const answerService = { listForQuestion: jest.fn() };
  const gameState = {
    hasSession: jest.fn(),
    getAdminQuestionContext: jest.fn(),
    getGameSessionId: jest.fn(),
  };
  const controller = new AnswerController(
    answerService as unknown as AnswerService,
    gameState as unknown as GameStateService,
  );
  return { controller, answerService, gameState };
}

const question: AdminQuestionContext = {
  type: 'free_text',
  prompt: 'Q1',
  points: 1,
  correctAnswer: 'A1',
  roundTitle: 'Round 1',
  roundNumber: 1,
  questionNumberInRound: 1,
  totalQuestionsInRound: 1,
};

const answers: AnswerView[] = [
  {
    answerId: 41,
    teamId: 31,
    teamName: 'The Quizzards',
    value: 'Banana',
    pointsAwarded: 0,
    gradedAt: null,
  },
];

describe('AnswerController', () => {
  it('is protected by SessionGuard + RolesGuard', () => {
    const guards = Reflect.getMetadata('__guards__', AnswerController) as
      | unknown[]
      | undefined;

    expect(guards).toContain(SessionGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('returns the question context and answers for a known question', async () => {
    const { controller, answerService, gameState } = makeController();
    gameState.hasSession.mockReturnValue(true);
    gameState.getAdminQuestionContext.mockReturnValue(question);
    gameState.getGameSessionId.mockReturnValue(101);
    answerService.listForQuestion.mockResolvedValue(answers);

    const result = await controller.list('ABCDEF', 21);

    expect(gameState.getAdminQuestionContext).toHaveBeenCalledWith(
      'ABCDEF',
      21,
    );
    expect(answerService.listForQuestion).toHaveBeenCalledWith(101, 21);
    expect(result).toEqual({ questionId: 21, question, answers });
  });

  it('404s for an unknown join code', async () => {
    const { controller, gameState } = makeController();
    gameState.hasSession.mockReturnValue(false);

    await expect(controller.list('NOPE12', 21)).rejects.toThrow(
      NotFoundException,
    );
    expect(gameState.getAdminQuestionContext).not.toHaveBeenCalled();
  });

  it('404s for an unknown question id', async () => {
    const { controller, gameState } = makeController();
    gameState.hasSession.mockReturnValue(true);
    gameState.getAdminQuestionContext.mockReturnValue(null);

    await expect(controller.list('ABCDEF', 999)).rejects.toThrow(
      NotFoundException,
    );
  });
});
