import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
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
import {
  addLeagueSessionSchema,
  leagueFieldsSchema,
  leaguesQuerySchema,
} from '@/league/league.schema';
import {
  LeagueNotFoundError,
  LeagueService,
  SessionNotEndedError,
  SessionNotFoundError,
} from '@/league/league.service';

function parseOrThrow<T>(
  result:
    | { success: true; data: T }
    | { success: false; error: { issues: { message: string }[] } },
  fallback: string,
): T {
  if (!result.success) {
    throw new BadRequestException(result.error.issues[0]?.message ?? fallback);
  }
  return result.data;
}

/** Maps the service's domain errors to HTTP; anything else is a real failure. */
async function mapErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (
      error instanceof LeagueNotFoundError ||
      error instanceof SessionNotFoundError
    ) {
      throw new NotFoundException(error.message);
    }
    if (error instanceof SessionNotEndedError) {
      throw new ConflictException(error.message);
    }
    throw error;
  }
}

// Reads are open to admin and moderator (the session form lists current
// leagues); every write is admin-only.
@Controller('leagues')
@UseGuards(SessionGuard, RolesGuard)
export class LeaguesController {
  constructor(private readonly leagueService: LeagueService) {}

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
    return mapErrors(() => this.leagueService.update(id, fields));
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await mapErrors(() => this.leagueService.remove(id));
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
    await mapErrors(() => this.leagueService.addSession(id, gameSessionId));
  }

  @Delete(':id/sessions/:gameSessionId')
  @Roles('admin')
  @HttpCode(204)
  async removeSession(
    @Param('id', ParseIntPipe) id: number,
    @Param('gameSessionId', ParseIntPipe) gameSessionId: number,
  ): Promise<void> {
    await mapErrors(() => this.leagueService.removeSession(id, gameSessionId));
  }
}
