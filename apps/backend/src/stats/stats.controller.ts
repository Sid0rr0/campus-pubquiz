import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  PlayedSessionsListedPayload,
  SessionDetailStats,
} from '@campus-pubquiz/types';
import { Roles } from '@/auth/roles.decorator';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { StatsService } from '@/stats/stats.service';
import {
  playedSessionsQuerySchema,
  renameSessionSchema,
} from '@/stats/stats-query.schema';

// No @Roles(...) — open to admin and moderator alike, same as teams/sessions.
@Controller('stats')
@UseGuards(SessionGuard, RolesGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

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

  @Get('sessions/:id')
  async getSessionDetail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SessionDetailStats> {
    return this.statsService.getSessionDetail(id);
  }

  // Admin-only, unlike the reads above — matches QuizController.remove:
  // permanently deleting played-session history is more destructive than
  // viewing it.
  @Delete('sessions/:id')
  @Roles('admin')
  @HttpCode(204)
  async deleteSession(@Param('id', ParseIntPipe) id: number): Promise<void> {
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
    await this.statsService.renameSession(id, parsed.data.name);
  }
}
