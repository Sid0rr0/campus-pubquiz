import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { TeamsListedPayload } from '@campus-pubquiz/types';
import { Roles } from '@/auth/roles.decorator';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { TeamService } from '@/team/team.service';
import { teamsQuerySchema } from '@/team/teams-query.schema';

@Controller('teams')
@UseGuards(SessionGuard, RolesGuard)
@Roles('admin')
export class TeamsController {
  constructor(private readonly teamService: TeamService) {}

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
}
