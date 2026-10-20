import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { DISPLAY_NAME_SQL } from '@/ended-sessions-read/session-display-name';

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

/** An ended session's header: what every screen about a past night shows. */
export interface EndedSessionHeader {
  gameSessionId: number;
  joinCode: string;
  quizId: number;
  displayName: string;
  customName: string | null;
  quizTitle: string;
  playedAt: Date;
  maxPoints: number;
}

/** An ended session a team took part in. */
export interface ParticipationRow extends EndedSessionHeader {
  teamId: number;
}

interface HeaderRow {
  game_session_id: number;
  join_code: string;
  quiz_id: number;
  display_name: string;
  custom_name: string | null;
  quiz_title: string;
  played_at: string | Date;
  max_points: string | number;
}

function headerOf(row: HeaderRow): EndedSessionHeader {
  return {
    gameSessionId: row.game_session_id,
    joinCode: row.join_code,
    quizId: row.quiz_id,
    displayName: row.display_name,
    customName: row.custom_name,
    quizTitle: row.quiz_title,
    playedAt: new Date(row.played_at),
    maxPoints: Number(row.max_points),
  };
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

  /**
   * Ended sessions as a query to narrow, join, order and page. Tables are
   * aliased `gs` (game_sessions) and `qz` (quizzes); columns: `game_session_id`,
   * `join_code`, `quiz_id`, `display_name`, `custom_name`, `quiz_title` and
   * `played_at` and `max_points` (the sum of the points of the session's quiz
   * questions, 0 for none).
   */
  endedSessionsQuery() {
    const knex: Knex = this.gameSessionTeams.getKnex();
    return knex('game_sessions as gs')
      .join('quizzes as qz', 'qz.id', 'gs.quiz_id')
      .where('gs.status', 'ended')
      .select('gs.id as game_session_id')
      .select('gs.join_code as join_code')
      .select('gs.quiz_id as quiz_id')
      .select(knex.raw(`${DISPLAY_NAME_SQL} as display_name`))
      .select('gs.name as custom_name')
      .select('qz.title as quiz_title')
      .select('gs.created_at as played_at')
      .select(
        knex.raw(
          `(select coalesce(sum(mq.points), 0) from rounds mr join questions mq on mq.round_id = mr.id where mr.quiz_id = gs.quiz_id) as max_points`,
        ),
      );
  }

  /** One session's header by id; null if it doesn't exist or hasn't ended. */
  async endedSession(
    gameSessionId: number,
  ): Promise<EndedSessionHeader | null> {
    const row = (await this.endedSessionsQuery()
      .where('gs.id', gameSessionId)
      .first()) as HeaderRow | undefined;
    return row ? headerOf(row) : null;
  }

  /** Every ended session each team took part in, newest first, session id breaking a tie. */
  async participations(
    teamIds: readonly number[],
  ): Promise<ParticipationRow[]> {
    if (teamIds.length === 0) return [];
    const rows = (await this.endedSessionsQuery()
      .join(
        this.participantsQuery({ teamIds }).as('p'),
        'p.game_session_id',
        'gs.id',
      )
      .select('p.team_id as team_id')
      .orderBy('gs.created_at', 'desc')
      .orderBy('gs.id', 'desc')) as (HeaderRow & { team_id: number })[];
    return rows.map((row) => ({ ...headerOf(row), teamId: row.team_id }));
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
