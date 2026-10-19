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
import { ThrottlerGuard } from '@nestjs/throttler';
import type { TeamNightDetail, TeamPageHistory } from '@campus-pubquiz/types';
import { TeamHistoryService } from '@/team/team-history.service';
import { teamPageBodySchema } from '@/team/team-page.schema';

/**
 * The public team page: a team's own history, opened with its team code. No
 * session cookie. The code travels in the POST body so it stays out of URLs
 * and logs, and the throttler slows down guessing.
 */
@Controller('team-page')
@UseGuards(ThrottlerGuard)
export class TeamPageController {
  constructor(private readonly teamHistory: TeamHistoryService) {}

  @Post()
  @HttpCode(200)
  async history(@Body() body: unknown): Promise<TeamPageHistory> {
    const parsed = teamPageBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('teamCode is required');
    }
    const detail = await this.teamHistory.detailByCode(parsed.data.teamCode);
    if (!detail) throw new NotFoundException('No team with that code');
    return {
      name: detail.name,
      summary: detail.summary,
      sessions: detail.sessions,
    };
  }

  /** One ended night: every question with the team's own answer and the key. */
  @Post('sessions/:sessionId')
  @HttpCode(200)
  async night(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() body: unknown,
  ): Promise<TeamNightDetail> {
    const parsed = teamPageBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('teamCode is required');
    }
    const detail = await this.teamHistory.nightByCode(
      parsed.data.teamCode,
      sessionId,
    );
    if (!detail) throw new NotFoundException('No team with that code');
    return detail;
  }
}
