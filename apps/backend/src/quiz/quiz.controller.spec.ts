import type { QuizSummary } from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { QuizController } from '@/quiz/quiz.controller';
import type { QuizService } from '@/quiz/quiz.service';
import type { GameStateService } from '@/game/game-state.service';

function makeController() {
  const quizService = { list: jest.fn() };
  const gameState = {
    getActiveQuizId: jest.fn().mockReturnValue(1),
    getDefaultJoinCode: jest.fn().mockReturnValue('ABCDEF'),
  };
  const controller = new QuizController(
    quizService as unknown as QuizService,
    gameState as unknown as GameStateService,
  );
  return { controller, quizService, gameState };
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

    await expect(controller.list()).resolves.toEqual({
      activeQuizId: 1,
      quizzes,
    });
  });
});
