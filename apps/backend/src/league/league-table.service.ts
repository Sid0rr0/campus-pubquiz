import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  LEAGUE_TOP_SIZE,
  type LeagueTable,
  type LeagueTop,
  type PublicLeague,
  type PublicLeaguesPayload,
} from '@campus-pubquiz/types';
import { League } from '@/db/entities/league.entity';
import { LeagueSession } from '@/db/entities/league-session.entity';
import type { LeagueRepository } from '@/db/repositories/league.repository';
import type { LeagueSessionRepository } from '@/db/repositories/league-session.repository';
import { buildLeagueTable, type TeamNight } from '@/league/league-table.calc';
import { venueToday } from '@/league/venue-date';
import { StandingsService } from '@/standings/standings.service';

interface AnsweredRow {
  gameSessionId: number;
  teamId: number;
}

function publicView(league: League, today: string): PublicLeague {
  return {
    id: league.id,
    name: league.name,
    startsOn: league.startsOn,
    endsOn: league.endsOn,
    current: league.endsOn >= today,
  };
}

/**
 * Owns the league table: which sessions count (ended members only), and the
 * public league list. Placings and who left come from {@link StandingsService}
 * and are never recomputed here; the scoring is the pure `buildLeagueTable`.
 * Anything that needs a team's league position or a league's top rows (team
 * page, lobby) calls {@link table} and reads `rows`.
 */
@Injectable()
export class LeagueTableService {
  constructor(
    @InjectRepository(League) private readonly leagues: LeagueRepository,
    @InjectRepository(LeagueSession)
    private readonly memberships: LeagueSessionRepository,
    private readonly standings: StandingsService,
  ) {}

  /** Public league list: current leagues first, then the rest, each newest first. */
  async publicLeagues(now = new Date()): Promise<PublicLeaguesPayload> {
    const today = venueToday(now);
    const leagues = await this.leagues.find(
      {},
      { orderBy: { startsOn: 'desc', id: 'desc' } },
    );
    const items = leagues.map((league) => publicView(league, today));
    return {
      items: [
        ...items.filter((league) => league.current),
        ...items.filter((league) => !league.current),
      ],
    };
  }

  /** The league's table over its ended member sessions; null for an unknown league. */
  async table(leagueId: number, now = new Date()): Promise<LeagueTable | null> {
    const league = await this.leagues.findOne({ id: leagueId });
    if (!league) return null;
    const nights = await this.nightsOf(league.id);
    return {
      ...publicView(league, venueToday(now)),
      rows: buildLeagueTable(nights),
    };
  }

  /**
   * The league the big screen lobby shows for a session: the most recently
   * created league it is in, with its top rows; null when it is in none.
   */
  async topFor(
    gameSessionId: number,
    now = new Date(),
  ): Promise<LeagueTop | null> {
    const newest = (await this.memberships
      .getKnex()('league_sessions as ls')
      .join('leagues as l', 'l.id', 'ls.league_id')
      .where('ls.game_session_id', gameSessionId)
      .orderBy([
        { column: 'l.created_at', order: 'desc' },
        { column: 'l.id', order: 'desc' },
      ])
      .first('l.id as leagueId')) as { leagueId: number } | undefined;
    if (!newest) return null;
    const table = await this.table(newest.leagueId, now);
    if (!table) return null;
    return { name: table.name, rows: table.rows.slice(0, LEAGUE_TOP_SIZE) };
  }

  private async nightsOf(leagueId: number): Promise<TeamNight[]> {
    const knex = this.memberships.getKnex();
    const sessionRows = (await knex('league_sessions as ls')
      .join('game_sessions as gs', 'gs.id', 'ls.game_session_id')
      .where('ls.league_id', leagueId)
      .where('gs.status', 'ended')
      .select('gs.id as gameSessionId')) as { gameSessionId: number }[];
    const sessionIds = sessionRows.map((row) => row.gameSessionId);
    if (sessionIds.length === 0) return [];

    const [standings, answered] = await Promise.all([
      this.standings.forSessions(sessionIds),
      knex('answers')
        .whereIn('game_session_id', sessionIds)
        .distinct(
          'game_session_id as gameSessionId',
          'team_id as teamId',
        ) as Promise<AnsweredRow[]>,
    ]);
    const answeredKeys = new Set(
      answered.map((row) => `${row.gameSessionId}:${row.teamId}`),
    );

    const nights: TeamNight[] = [];
    for (const gameSessionId of sessionIds) {
      const session = standings.get(gameSessionId)!;
      const base = (teamId: number) => ({
        teamId,
        answered: answeredKeys.has(`${gameSessionId}:${teamId}`),
      });
      for (const entry of session.leaderboard) {
        nights.push({
          ...base(entry.teamId),
          teamName: entry.teamName,
          placing: entry.rank,
          won: session.winner?.teamId === entry.teamId,
        });
      }
      for (const entry of session.departed) {
        nights.push({
          ...base(entry.teamId),
          teamName: entry.teamName,
          placing: null,
          won: false,
        });
      }
    }
    return nights;
  }
}
