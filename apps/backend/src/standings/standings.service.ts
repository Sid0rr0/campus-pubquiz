import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type { LeaderboardEntry } from '@campus-pubquiz/types';
import { rankTeams } from '@campus-pubquiz/types';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';

interface TeamTotalsRow {
  teamId: number;
  teamName: string;
  quizPoints: string | number;
  bonusPoints: string | number;
  positiveBonusPoints: string | number;
  negativeBonusPoints: string | number;
}

interface RoundRow {
  roundId: number;
  roundTitle: string;
}

interface RoundTotalRow {
  roundId: number;
  teamId: number;
  total: string | number;
}

export interface SessionStandings {
  /** Every roster team, already in final order with `rank`/`rankTo`. */
  leaderboard: LeaderboardEntry[];
  /** The one winner: the first ranked team (undefined for an empty roster). */
  winner: LeaderboardEntry | undefined;
}

/**
 * Owns who is ranked where in a session. Loads each roster team's quiz and
 * bonus points, then hands ordering and tie ranks to the shared ranking rule
 * rather than deciding them in SQL.
 */
@Injectable()
export class StandingsService {
  constructor(
    @InjectRepository(GameSessionTeam)
    private readonly gameSessionTeams: GameSessionTeamRepository,
  ) {}

  /** Just the ranked roster — what every live-leaderboard refresh needs. */
  async leaderboard(gameSessionId: number): Promise<LeaderboardEntry[]> {
    return (await this.forSession(gameSessionId)).leaderboard;
  }

  async forSession(gameSessionId: number): Promise<SessionStandings> {
    const [teams, rounds, roundTotals] = await Promise.all([
      this.loadTeamTotals(gameSessionId),
      this.loadRounds(gameSessionId),
      this.loadRoundTotals(gameSessionId),
    ]);

    const pointsByRoundAndTeam = new Map(
      roundTotals.map((row) => [
        `${row.roundId}:${row.teamId}`,
        Number(row.total),
      ]),
    );

    const entries: Omit<LeaderboardEntry, 'rank' | 'rankTo'>[] = teams.map(
      (row) => ({
        teamId: row.teamId,
        teamName: row.teamName,
        totalPoints: Number(row.quizPoints) + Number(row.bonusPoints),
        bonusPoints: Number(row.bonusPoints),
        positiveBonusPoints: Number(row.positiveBonusPoints),
        negativeBonusPoints: Number(row.negativeBonusPoints),
        roundPoints: rounds.map((round) => ({
          roundTitle: round.roundTitle,
          points:
            pointsByRoundAndTeam.get(`${round.roundId}:${row.teamId}`) ?? 0,
        })),
      }),
    );

    const leaderboard = rankTeams(entries);
    return { leaderboard, winner: leaderboard[0] };
  }

  private async loadTeamTotals(
    gameSessionId: number,
  ): Promise<TeamTotalsRow[]> {
    const knex = this.gameSessionTeams.getKnex();
    // Pre-aggregated as subqueries (rather than two leftJoins straight off
    // "t") so a team with several answers *and* several bonus awards doesn't
    // fan out into a cross product that inflates both sums.
    const answerTotals = knex('answers')
      .where('game_session_id', gameSessionId)
      .groupBy('team_id')
      .select('team_id')
      .select(knex.raw('sum(points_awarded) as total'));
    const bonusTotals = knex('bonus_awards')
      .where('game_session_id', gameSessionId)
      .groupBy('team_id')
      .select('team_id')
      .select(knex.raw('sum(points) as total'))
      .select(
        knex.raw(
          'sum(case when points > 0 then points else 0 end) as positive_total',
        ),
      )
      .select(
        knex.raw(
          'sum(case when points < 0 then points else 0 end) as negative_total',
        ),
      );

    return (await knex('game_session_teams as gst')
      .join('teams as t', 't.id', 'gst.team_id')
      .leftJoin(answerTotals.as('ans'), 'ans.team_id', 't.id')
      .leftJoin(bonusTotals.as('bonus'), 'bonus.team_id', 't.id')
      .where('gst.game_session_id', gameSessionId)
      .select('t.id as teamId', 't.name as teamName')
      .select(knex.raw('coalesce(ans.total, 0) as "quizPoints"'))
      .select(knex.raw('coalesce(bonus.total, 0) as "bonusPoints"'))
      .select(
        knex.raw('coalesce(bonus.positive_total, 0) as "positiveBonusPoints"'),
      )
      .select(
        knex.raw('coalesce(bonus.negative_total, 0) as "negativeBonusPoints"'),
      )) as TeamTotalsRow[];
  }

  /** Rounds belong to the session's *current* quiz, not necessarily the one any given answer was graded under (a mid-game re-import can swap it). */
  private async loadRounds(gameSessionId: number): Promise<RoundRow[]> {
    const knex = this.gameSessionTeams.getKnex();
    return (await knex('rounds as r')
      .join('game_sessions as gs', 'gs.quiz_id', 'r.quiz_id')
      .where('gs.id', gameSessionId)
      .orderBy('r.order_index', 'asc')
      .select('r.id as roundId', 'r.title as roundTitle')) as RoundRow[];
  }

  private async loadRoundTotals(
    gameSessionId: number,
  ): Promise<RoundTotalRow[]> {
    const knex = this.gameSessionTeams.getKnex();
    return (await knex('answers as a')
      .join('questions as q', 'q.id', 'a.question_id')
      .where('a.game_session_id', gameSessionId)
      .groupBy('q.round_id', 'a.team_id')
      .select('q.round_id as roundId', 'a.team_id as teamId')
      .select(knex.raw('sum(a.points_awarded) as total'))) as RoundTotalRow[];
  }
}
