import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  FeedbackTrends,
  PlayedSessionsListedPayload,
  SessionDetailStats,
} from '@campus-pubquiz/types';
import { Roles } from '@/auth/roles.decorator';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { GameStateService } from '@/game/state/game-state.service';
import { StatsService } from '@/stats/stats.service';
import {
  feedbackTrendsQuerySchema,
  playedSessionsQuerySchema,
  renameSessionSchema,
  sessionBriefQuerySchema,
} from '@/stats/stats-query.schema';

// No @Roles(...) — open to admin and moderator alike, same as teams/sessions.
@Controller('stats')
@UseGuards(SessionGuard, RolesGuard)
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly gameState: GameStateService,
  ) {}

  @Get('sessions')
  async listPlayedSessions(
    @Query() query: Record<string, unknown>,
  ): Promise<PlayedSessionsListedPayload> {
    const parsed = playedSessionsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid query',
      );
    }
    return this.statsService.listPlayedSessions(parsed.data);
  }

  @Get('feedback-trends')
  async getFeedbackTrends(
    @Query() query: Record<string, unknown>,
  ): Promise<FeedbackTrends> {
    const parsed = feedbackTrendsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid query',
      );
    }
    return this.statsService.getFeedbackTrends(parsed.data);
  }

  @Get('sessions/:id')
  async getSessionDetail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SessionDetailStats> {
    return this.statsService.getSessionDetail(id);
  }

  @Get('sessions/:id/brief')
  @Header('Content-Type', 'text/markdown; charset=utf-8')
  async getSessionBrief(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: Record<string, unknown>,
  ): Promise<string> {
    const parsed = sessionBriefQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid query',
      );
    }
    return this.statsService.getSessionBrief(id, parsed.data.timeZone);
  }

  // Admin-only, unlike the reads above — matches QuizController.remove:
  // permanently deleting played-session history is more destructive than
  // viewing it.
  @Delete('sessions/:id')
  @Roles('admin')
  @HttpCode(204)
  async deleteSession(@Param('id', ParseIntPipe) id: number): Promise<void> {
    if (this.gameState.isHeld(id)) {
      throw new ConflictException(
        'Close this session on the control page before deleting it',
      );
    }
    await this.statsService.deleteSession(id);
  }

  // Admin-only, same reasoning as deleteSession above.
  @Patch('sessions/:id')
  @Roles('admin')
  async renameSession(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ): Promise<void> {
    const parsed = renameSessionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid name',
      );
    }
    const customName = await this.statsService.renameSession(
      id,
      parsed.data.name,
    );
    await this.gameState.renameHeldSession(id, customName);
  }
}
