import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import type {
  PlayedSessionStats,
  SessionDetailStats,
} from '@campus-pubquiz/types';
import { Roles } from '@/auth/roles.decorator';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { StatsService } from '@/stats/stats.service';

// No @Roles(...) — open to admin and moderator alike, same as teams/sessions.
@Controller('stats')
@UseGuards(SessionGuard, RolesGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('sessions')
  async listPlayedSessions(): Promise<PlayedSessionStats[]> {
    return this.statsService.listPlayedSessions();
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
}
