import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { QuizzesListedPayload } from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { GameStateService } from '@/game/game-state.service';
import { QuizService } from '@/quiz/quiz.service';

@Controller('quizzes')
@UseGuards(SessionGuard, RolesGuard)
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
    private readonly gameState: GameStateService,
  ) {}

  @Get()
  async list(
    @Query('joinCode') joinCode?: string,
  ): Promise<QuizzesListedPayload> {
    const quizzes = await this.quizService.list();
    return {
      activeQuizId: joinCode ? this.gameState.getActiveQuizId(joinCode) : null,
      quizzes,
    };
  }
}
