import { Logger } from '@nestjs/common';
import type {
  LeagueTop,
  SessionSettings,
  SessionState,
} from '@campus-pubquiz/types';
import type { SessionSettingsChanges } from '@/game/state/session-settings-changes';
import type { SessionChange } from '@/game/state/session-write';
import type { LeagueTableService } from '@/league/league-table.service';
import type { LeagueService } from '@/league/league.service';

/**
 * The league change module: the leagues a live session counts towards and the
 * league the big screen lobby shows (`leagueTop`, a cache on the session).
 * Follows the pattern in `session-settings-changes.ts`. Every check runs
 * before any database write, so a refused event stores nothing.
 */
export class LeagueChanges {
  private readonly logger = new Logger('LeagueChanges');

  constructor(
    private readonly leagues: LeagueService,
    private readonly table: LeagueTableService,
    private readonly settings: SessionSettingsChanges,
  ) {}

  /**
   * The lobby league of a session, or null when it is in none or the read
   * fails (logged): a failed read leaves the lobby without a league rather
   * than failing the event it rides on. Also what a session being placed uses.
   */
  async topOrNull(gameSessionId: number): Promise<LeagueTop | null> {
    try {
      return await this.table.topFor(gameSessionId);
    } catch (error) {
      this.logger.error(
        `League top read failed for session ${gameSessionId}; the lobby shows no league`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  /** Re-reads the lobby league after a league was edited, deleted or had a session added or removed. */
  async refreshTop(session: SessionState): Promise<SessionChange<void>> {
    return {
      session: {
        ...session,
        leagueTop: await this.topOrNull(session.seededGame.gameSessionId),
      },
      outcome: undefined,
    };
  }

  /**
   * Replaces the session's leagues. Every id must be an existing current
   * league (one the session is already in may stay) and the session must not
   * have ended; both are refused before anything is written.
   */
  async setLeagues(
    session: SessionState,
    leagueIds: number[],
  ): Promise<SessionChange<void>> {
    await this.leagues.setSessionLeagues(
      session.seededGame.joinCode,
      leagueIds,
    );
    return this.refreshTop(session);
  }

  /**
   * One settings PATCH: lobby settings and/or leagues. Both are checked
   * before either is written, so a refused league or a started game leaves
   * nothing half-applied. Sending only leagues leaves the settings (and their
   * lobby-only rule) alone.
   */
  async settingsAndLeagues(
    session: SessionState,
    partial: Partial<SessionSettings>,
    leagueIds: number[] | undefined,
  ): Promise<SessionChange<void>> {
    if (leagueIds) {
      await this.leagues.assertSessionAssignable(
        session.seededGame.joinCode,
        leagueIds,
      );
    }
    let current = session;
    if (Object.keys(partial).length > 0 || !leagueIds) {
      current = (await this.settings.lobbySettings(current, partial)).session;
    }
    if (!leagueIds) return { session: current, outcome: undefined };
    return this.setLeagues(current, leagueIds);
  }
}
