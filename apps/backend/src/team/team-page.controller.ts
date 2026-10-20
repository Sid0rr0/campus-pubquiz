import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { TeamNightDetail, TeamPageHistory } from '@campus-pubquiz/types';
import { LeagueTableService } from '@/league/league-table.service';
import { TeamHistoryService } from '@/team/team-history.service';
import { teamPageBodySchema } from '@/team/team-page.schema';

const NIGHT_LIMIT_PER_MINUTE = 30;

/**
 * The public team page: a team's own history, opened with its team code. No
 * session cookie. The code travels in the POST body so it stays out of URLs
 * and logs, and the throttler slows down guessing.
 */
@Controller('team-page')
@UseGuards(ThrottlerGuard)
export class TeamPageController {
  constructor(
    private readonly teamHistory: TeamHistoryService,
    private readonly leagueTable: LeagueTableService,
  ) {}

  /** Opening the page is the guessing surface, so it keeps the strict default limit. */
  @Post()
  @HttpCode(200)
  async history(@Body() body: unknown): Promise<TeamPageHistory> {
    const detail = await this.teamHistory.detailByCode(parseTeamCode(body));
    if (!detail) throw new NotFoundException('No team with that code');
    return {
      name: detail.name,
      summary: detail.summary,
      sessions: detail.sessions,
      leagues: await this.leagueTable.positionsOf(detail.id),
    };
  }

  /**
   * One ended night: every question with the team's own answer and the key.
   * A team with a code in hand opens several nights, and phones share a venue
   * NAT, so this has a looser limit than the history call.
   */
  @Post('sessions/:sessionId')
  @Throttle({ default: { limit: NIGHT_LIMIT_PER_MINUTE, ttl: 60_000 } })
  @HttpCode(200)
  async night(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() body: unknown,
  ): Promise<TeamNightDetail> {
    const detail = await this.teamHistory.nightByCode(
      parseTeamCode(body),
      sessionId,
    );
    if (!detail) throw new NotFoundException('No team with that code');
    return detail;
  }
}

/** The team code from a request body; 400 when it is missing or unusable. */
function parseTeamCode(body: unknown): string {
  const parsed = teamPageBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException('teamCode is required');
  }
  return parsed.data.teamCode;
}
