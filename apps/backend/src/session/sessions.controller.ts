import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  ActiveSessionSummary,
  CreateSessionPayload,
  SessionSettings,
} from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { LiveSessionRest } from '@/game/rest/live-session-rest.service';
import {
  GameStateService,
  QuizHasEmptyRoundError,
  SessionCloseBlockedError,
  SessionSettingsUpdateBlockedError,
} from '@/game/state/game-state.service';
import { leagueIdsSchema } from '@/league/league.schema';
import { mapUnknownLiveSession } from '@/game/rest/live-session-http';
import { mapLeagueErrors } from '@/league/league-http';
import { LeagueService } from '@/league/league.service';
import {
  resolveSessionSettings,
  sessionSettingsPartialSchema,
} from '@/session/session-settings.schema';

function requireQuizId(body: Partial<CreateSessionPayload>): number {
  if (typeof body.quizId !== 'number' || !Number.isInteger(body.quizId)) {
    throw new BadRequestException('quizId is required');
  }
  return body.quizId;
}

function parseName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

function parseSettingsPartial(raw: unknown): Partial<SessionSettings> {
  const parsed = sessionSettingsPartialSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new BadRequestException(issue?.message ?? 'Invalid settings');
  }
  return parsed.data;
}

/** Pulls `leagueIds` out of a settings patch: it is not a session setting and has its own rules. */
function splitLeagueIds(body: unknown): {
  settingsBody: unknown;
  leagueIds: number[] | undefined;
} {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { settingsBody: body, leagueIds: undefined };
  }
  const { leagueIds, ...settingsBody } = body as Record<string, unknown>;
  return { settingsBody, leagueIds: parseLeagueIds(leagueIds) };
}

function parseLeagueIds(raw: unknown): number[] | undefined {
  if (raw === undefined) return undefined;
  const parsed = leagueIdsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BadRequestException('leagueIds must be a list of league ids');
  }
  return parsed.data;
}

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly gameState: GameStateService,
    private readonly leagues: LeagueService,
    private readonly liveSession: LiveSessionRest,
  ) {}

  /**
   * Unauthenticated on purpose — /display runs on venue TV/projector
   * hardware that has no admin login of its own, so it needs a way to list
   * running sessions and let the operator pick one without signing in.
   * Exposes nothing beyond what a session's own join code already reveals
   * once printed on the lobby QR code (title, status, team count).
   */
  @Get('public')
  listPublic(): ActiveSessionSummary[] {
    return this.gameState.listSessions();
  }

  @Get()
  @UseGuards(SessionGuard, RolesGuard)
  list(): ActiveSessionSummary[] {
    return this.gameState.listSessions();
  }

  @Post()
  @UseGuards(SessionGuard, RolesGuard)
  async create(
    @Body() body: Partial<CreateSessionPayload>,
  ): Promise<ActiveSessionSummary> {
    const quizId = requireQuizId(body);
    const settings = resolveSessionSettings(
      parseSettingsPartial(body.settings),
    );
    const name = parseName(body.name);
    const leagueIds = parseLeagueIds(body.leagueIds) ?? [];
    await mapLeagueErrors(() => this.leagues.assertAssignable(leagueIds));
    return this.gameState
      .createSession(quizId, settings, name, leagueIds)
      .catch((error: unknown) => {
        if (error instanceof QuizHasEmptyRoundError) {
          throw new BadRequestException(error.message);
        }
        throw error;
      });
  }

  @Patch(':joinCode/settings')
  @UseGuards(SessionGuard, RolesGuard)
  async updateSettings(
    @Param('joinCode') joinCode: string,
    @Body() body: unknown,
  ): Promise<void> {
    try {
      await mapUnknownLiveSession(() =>
        mapLeagueErrors(() =>
          this.liveSession.updateSettingsAndLeagues(joinCode, () => {
            const { settingsBody, leagueIds } = splitLeagueIds(body);
            return { partial: parseSettingsPartial(settingsBody), leagueIds };
          }),
        ),
      );
    } catch (error) {
      if (error instanceof SessionSettingsUpdateBlockedError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  @Delete(':joinCode')
  @UseGuards(SessionGuard, RolesGuard)
  async close(@Param('joinCode') joinCode: string): Promise<void> {
    try {
      await mapUnknownLiveSession(() =>
        this.liveSession.closeSession(joinCode),
      );
    } catch (error) {
      if (error instanceof SessionCloseBlockedError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
