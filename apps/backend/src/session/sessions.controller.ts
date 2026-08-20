import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  ActiveSessionSummary,
  CreateSessionPayload,
  SessionSettings,
} from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { GameGateway } from '@/game/game.gateway';
import {
  GameStateService,
  SessionCloseBlockedError,
  SessionSettingsUpdateBlockedError,
} from '@/game/game-state.service';
import { QuizService } from '@/quiz/quiz.service';
import {
  resolveSessionSettings,
  sessionSettingsPartialSchema,
} from '@/session/session-settings.schema';

const UNKNOWN_QUIZ_TITLE = 'Unknown quiz';

function requireQuizId(body: Partial<CreateSessionPayload>): number {
  if (typeof body.quizId !== 'number' || !Number.isInteger(body.quizId)) {
    throw new BadRequestException('quizId is required');
  }
  return body.quizId;
}

function parseSettingsPartial(raw: unknown): Partial<SessionSettings> {
  const parsed = sessionSettingsPartialSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new BadRequestException(issue?.message ?? 'Invalid settings');
  }
  return parsed.data;
}

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly gameState: GameStateService,
    private readonly quizService: QuizService,
    private readonly gameGateway: GameGateway,
  ) {}

  /**
   * Unauthenticated on purpose — /display runs on venue TV/projector
   * hardware that has no admin login of its own, so it needs a way to list
   * running sessions and let the operator pick one without signing in.
   * Exposes nothing beyond what a session's own join code already reveals
   * once printed on the lobby QR code (title, status, team count).
   */
  @Get('public')
  async listPublic(): Promise<ActiveSessionSummary[]> {
    return this.summarize(this.gameState.listSessions());
  }

  @Get()
  @UseGuards(SessionGuard, RolesGuard)
  async list(): Promise<ActiveSessionSummary[]> {
    return this.summarize(this.gameState.listSessions());
  }

  @Post()
  @UseGuards(SessionGuard, RolesGuard)
  async create(
    @Body() body: Partial<CreateSessionPayload>,
  ): Promise<ActiveSessionSummary> {
    const quizId = requireQuizId(body);
    const settings = resolveSessionSettings(
      parseSettingsPartial(body.settings),
    );
    const snapshot = await this.gameState.createSession(quizId, settings);
    const titles = await this.quizService.findTitles([quizId]);
    return {
      joinCode: snapshot.joinCode,
      quizId,
      quizTitle: titles.get(quizId) ?? UNKNOWN_QUIZ_TITLE,
      status: snapshot.progress.status,
      teamCount: snapshot.teams.length,
    };
  }

  @Patch(':joinCode/settings')
  @UseGuards(SessionGuard, RolesGuard)
  async updateSettings(
    @Param('joinCode') joinCode: string,
    @Body() body: unknown,
  ): Promise<void> {
    if (!this.gameState.hasSession(joinCode)) {
      throw new NotFoundException(`Unknown session "${joinCode}"`);
    }
    const partial = parseSettingsPartial(body);
    try {
      await this.gameState.updateSessionSettings(joinCode, partial);
    } catch (error) {
      if (error instanceof SessionSettingsUpdateBlockedError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
    this.gameGateway.notifySettingsUpdated(joinCode);
  }

  @Delete(':joinCode')
  @UseGuards(SessionGuard, RolesGuard)
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
    this.gameGateway.notifySessionClosed(joinCode);
  }

  private async summarize(
    sessions: Omit<ActiveSessionSummary, 'quizTitle'>[],
  ): Promise<ActiveSessionSummary[]> {
    const titles = await this.quizService.findTitles(
      sessions.map((session) => session.quizId),
    );
    return sessions.map((session) => ({
      ...session,
      quizTitle: titles.get(session.quizId) ?? UNKNOWN_QUIZ_TITLE,
    }));
  }
}
