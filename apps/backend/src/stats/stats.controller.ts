import { Controller, Get, UseGuards } from '@nestjs/common';
import type { PlayedSessionStats } from '@campus-pubquiz/types';
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
}
