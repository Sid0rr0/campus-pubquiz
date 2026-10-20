import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  LEAGUE_TOP_SIZE,
  type LeagueTable,
  type LeagueTop,
  type PublicLeague,
  type PublicLeaguesPayload,
  type TeamLeaguePosition,
} from '@campus-pubquiz/types';
import { EndedSessionsRead } from '@/ended-sessions-read/ended-sessions-read';
import { League } from '@/db/entities/league.entity';
import { LeagueSession } from '@/db/entities/league-session.entity';
import type { LeagueRepository } from '@/db/repositories/league.repository';
import type { LeagueSessionRepository } from '@/db/repositories/league-session.repository';
import {
  buildLeagueTable,
  teamNightsOf,
  type TeamNight,
} from '@/league/league-table.calc';
import { LEAGUE_ORDER } from '@/league/league.service';
import { isCurrentLeague, venueToday } from '@/league/venue-date';
import { StandingsService } from '@/standings/standings.service';

function publicView(league: League, today: string): PublicLeague {
  return {
    id: league.id,
    name: league.name,
    startsOn: league.startsOn,
    endsOn: league.endsOn,
    current: isCurrentLeague(league.endsOn, today),
  };
}

/**
 * Owns the league table: which sessions count (ended members only), and the
 * public league list. Each team's night (placing, answered, night won) comes
 * from the Session result via {@link StandingsService.resultsForSessions} and
 * is never recomputed here; the scoring is the pure `buildLeagueTable`.
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
    private readonly endedSessions: EndedSessionsRead,
  ) {}

  /** Public league list: current leagues first, then the rest, each in the admin's order. */
  async publicLeagues(now = new Date()): Promise<PublicLeaguesPayload> {
    const today = venueToday(now);
    const leagues = await this.leagues.find({}, { orderBy: LEAGUE_ORDER });
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
    const newest: { leagueId: number } | undefined = await this.memberships
      .getKnex()('league_sessions as ls')
      .join('leagues as l', 'l.id', 'ls.league_id')
      .where('ls.game_session_id', gameSessionId)
      .orderBy([
        { column: 'l.created_at', order: 'desc' },
        { column: 'l.id', order: 'desc' },
      ])
      .first('l.id as leagueId');
    if (!newest) return null;
    const table = await this.table(newest.leagueId, now);
    if (!table) return null;
    return { name: table.name, rows: table.rows.slice(0, LEAGUE_TOP_SIZE) };
  }

  /**
   * The team's standing in every current league where it has points, newest
   * league first. Positions are the public table's own, so the two never differ.
   */
  async positionsOf(
    teamId: number,
    now = new Date(),
  ): Promise<TeamLeaguePosition[]> {
    const { items } = await this.publicLeagues(now);
    const tables = await Promise.all(
      items
        .filter((league) => league.current)
        .map((l) => this.table(l.id, now)),
    );
    const positions: TeamLeaguePosition[] = [];
    for (const table of tables) {
      const row = table?.rows.find((r) => r.teamId === teamId);
      if (!table || !row || row.leaguePoints <= 0) continue;
      positions.push({
        leagueId: table.id,
        leagueName: table.name,
        position: row.position,
        shared:
          table.rows.filter((r) => r.position === row.position).length > 1,
        teamCount: table.rows.length,
        leaguePoints: row.leaguePoints,
      });
    }
    return positions;
  }

  private async nightsOf(leagueId: number): Promise<TeamNight[]> {
    const sessionRows = (await this.endedSessions
      .endedSessionsQuery()
      .join('league_sessions as ls', 'ls.game_session_id', 'gs.id')
      .where('ls.league_id', leagueId)) as { game_session_id: number }[];
    const sessionIds = sessionRows.map((row) => row.game_session_id);
    if (sessionIds.length === 0) return [];

    const results = await this.standings.resultsForSessions(sessionIds);
    return sessionIds.flatMap((id) => teamNightsOf(results.get(id)!));
  }
}
