import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';

type Knex = ReturnType<GameSessionTeamRepository['getKnex']>;

/** Narrows participants to some sessions or some teams; everything when omitted. */
export type ParticipantScope =
  | { gameSessionIds: readonly number[] }
  | { teamIds: readonly number[] };

export interface ParticipantRow {
  gameSessionId: number;
  teamId: number;
  isOnRoster: boolean;
}

function scoped<Q extends { whereIn(column: string, ids: number[]): Q }>(
  query: Q,
  scope: ParticipantScope | undefined,
): Q {
  if (!scope) return query;
  return 'gameSessionIds' in scope
    ? query.whereIn('game_session_id', [...scope.gameSessionIds])
    : query.whereIn('team_id', [...scope.teamIds]);
}

/**
 * The database side of looking back at past nights, and the one definition of
 * **took part**: a team took part in a session if it is on the roster now, or
 * has an answer or a bonus award stored for it (kicking or leaving deletes the
 * roster row but keeps those). Session status is ignored on purpose: the
 * Standings module also uses this for live sessions.
 */
@Injectable()
export class EndedSessionsRead {
  constructor(
    @InjectRepository(GameSessionTeam)
    private readonly gameSessionTeams: GameSessionTeamRepository,
  ) {}

  /**
   * Participants as a query to join or filter: `game_session_id`, `team_id`
   * and `is_on_roster`, one row per team per session.
   */
  participantsQuery(scope?: ParticipantScope) {
    const knex: Knex = this.gameSessionTeams.getKnex();
    const marks = scoped(knex('game_session_teams'), scope)
      .select('game_session_id', 'team_id')
      .union([
        scoped(knex('answers'), scope).select('game_session_id', 'team_id'),
        scoped(knex('bonus_awards'), scope).select(
          'game_session_id',
          'team_id',
        ),
      ]);
    return knex
      .from(marks.as('p'))
      .leftJoin('game_session_teams as roster', function joinRoster() {
        this.on('roster.game_session_id', 'p.game_session_id').andOn(
          'roster.team_id',
          'p.team_id',
        );
      })
      .select('p.game_session_id as game_session_id')
      .select('p.team_id as team_id')
      .select(knex.raw('(roster.team_id is not null) as is_on_roster'));
  }

  /**
   * Sessions played per team as a query to join, sort by and page:
   * `team_id` and `sessions_played`, the count of ended sessions the team took
   * part in. Teams that took part in none have no row; join with a coalesce.
   */
  sessionsPlayedQuery() {
    const knex: Knex = this.gameSessionTeams.getKnex();
    return this.participantsQuery()
      .join('game_sessions as ended_gs', 'ended_gs.id', 'p.game_session_id')
      .where('ended_gs.status', 'ended')
      .groupBy('p.team_id')
      .clearSelect()
      .select('p.team_id as team_id')
      .select(knex.raw('count(*) as sessions_played'));
  }

  /** Every team that took part in the given sessions, or in any session for the given teams. */
  async participants(scope: ParticipantScope): Promise<ParticipantRow[]> {
    const rows = (await this.participantsQuery(scope)) as {
      game_session_id: number;
      team_id: number;
      is_on_roster: boolean;
    }[];
    return rows.map((row) => ({
      gameSessionId: row.game_session_id,
      teamId: row.team_id,
      isOnRoster: row.is_on_roster,
    }));
  }
}
