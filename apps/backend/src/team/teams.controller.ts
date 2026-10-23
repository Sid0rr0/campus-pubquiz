import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  TeamCodeView,
  TeamDetail,
  TeamMergeCandidatesPayload,
  TeamMergePairPreview,
  TeamMergedPayload,
  TeamsListedPayload,
} from '@campus-pubquiz/types';
import {
  TeamMergeNotFoundError,
  TeamMergeRefusedError,
  TeamMergeService,
} from '@/team/team-merge.service';
import {
  teamMergeBodySchema,
  teamMergePreviewQuerySchema,
} from '@/team/team-merge.schema';
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
    private readonly teamMerge: TeamMergeService,
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

  @Get(':id/merge-preview')
  async mergePreview(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: Record<string, unknown>,
  ): Promise<TeamMergeCandidatesPayload | TeamMergePairPreview> {
    const parsed = teamMergePreviewQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid query',
      );
    }
    const { otherTeamId } = parsed.data;
    return this.mergeOutcome(async () =>
      otherTeamId === undefined
        ? { candidates: await this.teamMerge.candidates(id) }
        : this.teamMerge.pairPreview(id, otherTeamId),
    );
  }

  @Post(':id/merge')
  async merge(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ): Promise<TeamMergedPayload> {
    const parsed = teamMergeBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid body',
      );
    }
    return this.mergeOutcome(() =>
      this.teamMerge.merge(id, parsed.data.otherTeamId, parsed.data.name),
    );
  }

  /** Maps the merge module's errors to 404 (unknown team) and 409 (refused). */
  private async mergeOutcome<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof TeamMergeNotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof TeamMergeRefusedError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
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
