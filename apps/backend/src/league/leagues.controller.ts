import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { LeaguesListedPayload, LeagueView } from '@campus-pubquiz/types';
import { Roles } from '@/auth/roles.decorator';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { LiveSessionRest } from '@/game/rest/live-session-rest.service';
import {
  addLeagueSessionSchema,
  leagueFieldsSchema,
  leaguesQuerySchema,
  moveLeagueSchema,
} from '@/league/league.schema';
import { mapLeagueErrors, parseOrThrow } from '@/league/league-http';
import { LeagueService } from '@/league/league.service';

// Reads are open to admin and moderator (the session form lists current
// leagues); every write is admin-only. A write that can change a league table
// refreshes the lobby league of every live session afterwards.
@Controller('leagues')
@UseGuards(SessionGuard, RolesGuard)
export class LeaguesController {
  constructor(
    private readonly leagueService: LeagueService,
    private readonly liveSession: LiveSessionRest,
  ) {}

  private refreshLobbies(): Promise<void> {
    return this.liveSession.refreshLeagueLobbies();
  }

  @Get()
  async list(
    @Query() query: Record<string, unknown>,
  ): Promise<LeaguesListedPayload> {
    const { current } = parseOrThrow(
      leaguesQuerySchema.safeParse(query),
      'Invalid query',
    );
    return this.leagueService.list({ current });
  }

  @Post()
  @Roles('admin')
  async create(@Body() body: unknown): Promise<LeagueView> {
    const fields = parseOrThrow(
      leagueFieldsSchema.safeParse(body),
      'Invalid league',
    );
    return this.leagueService.create(fields);
  }

  @Patch(':id')
  @Roles('admin')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ): Promise<LeagueView> {
    const fields = parseOrThrow(
      leagueFieldsSchema.safeParse(body),
      'Invalid league',
    );
    const league = await mapLeagueErrors(() =>
      this.leagueService.update(id, fields),
    );
    await this.refreshLobbies();
    return league;
  }

  @Post(':id/move')
  @Roles('admin')
  @HttpCode(204)
  async move(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ): Promise<void> {
    const { direction } = parseOrThrow(
      moveLeagueSchema.safeParse(body),
      'direction must be "up" or "down"',
    );
    await mapLeagueErrors(() => this.leagueService.move(id, direction));
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await mapLeagueErrors(() => this.leagueService.remove(id));
    await this.refreshLobbies();
  }

  @Post(':id/sessions')
  @Roles('admin')
  @HttpCode(204)
  async addSession(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ): Promise<void> {
    const { gameSessionId } = parseOrThrow(
      addLeagueSessionSchema.safeParse(body),
      'gameSessionId is required',
    );
    await mapLeagueErrors(() =>
      this.leagueService.addSession(id, gameSessionId),
    );
    await this.refreshLobbies();
  }

  @Delete(':id/sessions/:gameSessionId')
  @Roles('admin')
  @HttpCode(204)
  async removeSession(
    @Param('id', ParseIntPipe) id: number,
    @Param('gameSessionId', ParseIntPipe) gameSessionId: number,
  ): Promise<void> {
    await mapLeagueErrors(() =>
      this.leagueService.removeSession(id, gameSessionId),
    );
    await this.refreshLobbies();
  }
}
