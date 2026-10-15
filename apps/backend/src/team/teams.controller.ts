import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  TeamCodeView,
  TeamDetail,
  TeamsListedPayload,
} from '@campus-pubquiz/types';
import { TeamHistoryService } from '@/team/team-history.service';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { TeamService } from '@/team/team.service';
import { teamsQuerySchema } from '@/team/teams-query.schema';

// No @Roles(...) — open to admin and moderator alike, same as sessions.
@Controller('teams')
@UseGuards(SessionGuard, RolesGuard)
export class TeamsController {
  constructor(
    private readonly teamService: TeamService,
    private readonly teamHistory: TeamHistoryService,
  ) {}

  @Get()
  async list(
    @Query() query: Record<string, unknown>,
  ): Promise<TeamsListedPayload> {
    const parsed = teamsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid query',
      );
    }
    return this.teamService.listAll(parsed.data);
  }

  @Get(':id')
  async getDetail(@Param('id', ParseIntPipe) id: number): Promise<TeamDetail> {
    const detail = await this.teamHistory.detail(id);
    if (!detail) {
      throw new NotFoundException(`Team ${id} not found`);
    }
    return detail;
  }

  @Get(':id/code')
  async getCode(@Param('id', ParseIntPipe) id: number): Promise<TeamCodeView> {
    const team = await this.teamService.getTeamCode(id);
    if (!team) {
      throw new NotFoundException(`Team ${id} not found`);
    }
    return team;
  }
}
