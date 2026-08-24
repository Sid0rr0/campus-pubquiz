import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import type { AnswersUpdatedPayload } from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { AnswerService } from '@/answer/answer.service';
import { GameStateService } from '@/game/state/game-state.service';

@Controller('sessions/:joinCode/answers')
@UseGuards(SessionGuard, RolesGuard)
export class AnswerController {
  constructor(
    private readonly answerService: AnswerService,
    private readonly gameState: GameStateService,
  ) {}

  @Get(':questionId')
  async list(
    @Param('joinCode') joinCode: string,
    @Param('questionId', ParseIntPipe) questionId: number,
  ): Promise<AnswersUpdatedPayload> {
    if (!this.gameState.hasSession(joinCode)) {
      throw new NotFoundException(`Unknown session "${joinCode}"`);
    }

    const question = this.gameState.getAdminQuestionContext(
      joinCode,
      questionId,
    );
    if (!question) {
      throw new NotFoundException(`Unknown question ${questionId}`);
    }

    const answers = await this.answerService.listForQuestion(
      this.gameState.getGameSessionId(joinCode),
      questionId,
    );
    return { questionId, question, answers };
  }
}
