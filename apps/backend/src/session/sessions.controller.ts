import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  ActiveSessionSummary,
  CreateSessionPayload,
} from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import {
  GameStateService,
  SessionCloseBlockedError,
} from '@/game/game-state.service';
import { QuizService } from '@/quiz/quiz.service';

const UNKNOWN_QUIZ_TITLE = 'Unknown quiz';

function requireQuizId(body: Partial<CreateSessionPayload>): number {
  if (typeof body.quizId !== 'number' || !Number.isInteger(body.quizId)) {
    throw new BadRequestException('quizId is required');
  }
  return body.quizId;
}

@Controller('sessions')
@UseGuards(SessionGuard, RolesGuard)
export class SessionsController {
  constructor(
    private readonly gameState: GameStateService,
    private readonly quizService: QuizService,
  ) {}

  @Get()
  async list(): Promise<ActiveSessionSummary[]> {
    const sessions = this.gameState.listSessions();
    const titles = await this.quizService.findTitles(
      sessions.map((session) => session.quizId),
    );
    return sessions.map((session) => ({
      ...session,
      quizTitle: titles.get(session.quizId) ?? UNKNOWN_QUIZ_TITLE,
    }));
  }

  @Post()
  async create(
    @Body() body: Partial<CreateSessionPayload>,
  ): Promise<ActiveSessionSummary> {
    const quizId = requireQuizId(body);
    const snapshot = await this.gameState.createSession(quizId);
    const titles = await this.quizService.findTitles([quizId]);
    return {
      joinCode: snapshot.joinCode,
      quizId,
      quizTitle: titles.get(quizId) ?? UNKNOWN_QUIZ_TITLE,
      status: snapshot.progress.status,
      teamCount: snapshot.teams.length,
    };
  }

  @Delete(':joinCode')
  close(@Param('joinCode') joinCode: string): void {
    if (!this.gameState.hasSession(joinCode)) {
      throw new NotFoundException(`Unknown session "${joinCode}"`);
    }
    try {
      this.gameState.closeSession(joinCode);
    } catch (error) {
      if (error instanceof SessionCloseBlockedError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
