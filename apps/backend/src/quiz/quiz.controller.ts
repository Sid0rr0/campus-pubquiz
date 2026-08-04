import { Controller, Get, UseGuards } from '@nestjs/common';
import type { QuizzesListedPayload } from '@campus-pubquiz/types';
import { AdminPasswordGuard } from '@/auth/admin-password.guard';
import { GameStateService } from '@/game/game-state.service';
import { QuizService } from '@/quiz/quiz.service';

@Controller('quizzes')
@UseGuards(AdminPasswordGuard)
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
    private readonly gameState: GameStateService,
  ) {}

  @Get()
  async list(): Promise<QuizzesListedPayload> {
    const quizzes = await this.quizService.list();
    return {
      activeQuizId: this.gameState.getActiveQuizId(),
      quizzes,
    };
  }
}
