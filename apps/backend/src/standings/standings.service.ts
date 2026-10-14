import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type { LeaderboardEntry } from '@campus-pubquiz/types';
import { compareTeamNames, rankTeams } from '@campus-pubquiz/types';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';

/** A team's points with no place in the ranking — one that took part but is no longer on the roster. */
export type DepartedTeam = Omit<LeaderboardEntry, 'rank' | 'rankTo'>;

export interface SessionStandings {
  /** Every roster team, already in final order with `rank`/`rankTo`. */
  leaderboard: LeaderboardEntry[];
  /** Teams that took part but were kicked or left: points only, never ranked, highest total first. */
  departed: DepartedTeam[];
  /** Ranked plus departed teams — the team count every stats denominator uses. */
  participantCount: number;
  /** The one winner: the first ranked team (undefined for an empty roster). Never a departed team. */
  winner: LeaderboardEntry | undefined;
}

interface TeamTotalsRow {
  gameSessionId: number;
  teamId: number;
  teamName: string;
  isOnRoster: boolean;
  quizPoints: string | number;
  bonusPoints: string | number;
  positiveBonusPoints: string | number;
  negativeBonusPoints: string | number;
}

interface RoundRow {
  gameSessionId: number;
  roundId: number;
  roundTitle: string;
}

interface RoundTotalRow {
  gameSessionId: number;
  roundId: number;
  teamId: number;
  total: string | number;
}

type Knex = ReturnType<GameSessionTeamRepository['getKnex']>;

/** Narrows a query to the given sessions; every session when no ids are given. */
function inSessions<Q extends { whereIn(column: string, ids: number[]): Q }>(
  query: Q,
  gameSessionIds: readonly number[] | undefined,
): Q {
  return gameSessionIds
    ? query.whereIn('game_session_id', [...gameSessionIds])
    : query;
}

/**
 * A team took part if it is on the roster or left a mark on the session:
 * kicking or leaving hard-deletes the roster row, but graded answers and
 * bonus awards stay.
 */
function participantsQuery(knex: Knex, gameSessionIds?: readonly number[]) {
  return inSessions(knex('game_session_teams'), gameSessionIds)
    .select('game_session_id', 'team_id')
    .union([
      inSessions(knex('answers'), gameSessionIds).select(
        'game_session_id',
        'team_id',
      ),
      inSessions(knex('bonus_awards'), gameSessionIds).select(
        'game_session_id',
        'team_id',
      ),
    ]);
}

// The two totals are pre-aggregated as subqueries (rather than two leftJoins
// straight off the participants) so a team with several answers *and* several
// bonus awards doesn't fan out into a cross product that inflates both sums.
function answerTotalsQuery(knex: Knex, gameSessionIds?: readonly number[]) {
  return inSessions(knex('answers'), gameSessionIds)
    .groupBy('game_session_id', 'team_id')
    .select('game_session_id', 'team_id')
    .select(knex.raw('sum(points_awarded) as total'));
}

function bonusTotalsQuery(knex: Knex, gameSessionIds?: readonly number[]) {
  return inSessions(knex('bonus_awards'), gameSessionIds)
    .groupBy('game_session_id', 'team_id')
    .select('game_session_id', 'team_id')
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
}

/**
 * Owns who took part in a session, how teams are ordered and how ties are
 * ranked. A team took part if it is on the roster *or* has an answer or
 * bonus award in the session; only roster teams are ranked. Totals are loaded
 * in SQL, ordering and tie ranks come from the shared ranking rule.
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
    const bySession = await this.forSessions([gameSessionId]);
    return bySession.get(gameSessionId)!;
  }

  /** Standings for several sessions in a fixed number of queries, each session's own teams only. */
  async forSessions(
    gameSessionIds: readonly number[],
  ): Promise<Map<number, SessionStandings>> {
    const [teams, rounds, roundTotals] = await Promise.all([
      this.loadTeamTotals(gameSessionIds),
      this.loadRounds(gameSessionIds),
      this.loadRoundTotals(gameSessionIds),
    ]);

    const pointsByRoundAndTeam = new Map(
      roundTotals.map((row) => [
        `${row.gameSessionId}:${row.roundId}:${row.teamId}`,
        Number(row.total),
      ]),
    );

    const result = new Map<number, SessionStandings>();
    for (const gameSessionId of gameSessionIds) {
      const sessionRounds = rounds.filter(
        (round) => round.gameSessionId === gameSessionId,
      );
      const entries = teams
        .filter((row) => row.gameSessionId === gameSessionId)
        .map((row) => ({
          isOnRoster: row.isOnRoster,
          entry: {
            teamId: row.teamId,
            teamName: row.teamName,
            totalPoints: Number(row.quizPoints) + Number(row.bonusPoints),
            bonusPoints: Number(row.bonusPoints),
            positiveBonusPoints: Number(row.positiveBonusPoints),
            negativeBonusPoints: Number(row.negativeBonusPoints),
            roundPoints: sessionRounds.map((round) => ({
              roundTitle: round.roundTitle,
              points:
                pointsByRoundAndTeam.get(
                  `${gameSessionId}:${round.roundId}:${row.teamId}`,
                ) ?? 0,
            })),
          } satisfies DepartedTeam,
        }));

      const leaderboard = rankTeams(
        entries.filter((e) => e.isOnRoster).map((e) => e.entry),
      );
      const departed = entries
        .filter((e) => !e.isOnRoster)
        .map((e) => e.entry)
        .sort(
          (a, b) =>
            b.totalPoints - a.totalPoints ||
            compareTeamNames(a.teamName, b.teamName) ||
            a.teamId - b.teamId,
        );
      result.set(gameSessionId, {
        leaderboard,
        departed,
        participantCount: entries.length,
        winner: leaderboard[0],
      });
    }
    return result;
  }

  /**
   * Per-session totals as a query to join and order by, for every session:
   * `game_session_id`, `participant_count` and `winner_total` (the highest
   * roster team total, null for an empty roster). Built from the same
   * participant and team-total subqueries as the standings, so a list sorted
   * by these numbers agrees with the standings it shows. A session nobody took
   * part in has no row.
   */
  sessionTotalsQuery() {
    const knex = this.gameSessionTeams.getKnex();
    const answerTotals = answerTotalsQuery(knex);
    const bonusTotals = bonusTotalsQuery(knex);

    const participantCounts = knex
      .from(participantsQuery(knex).as('p'))
      .groupBy('p.game_session_id')
      .select('p.game_session_id as game_session_id')
      .select(knex.raw('count(*) as participant_count'));

    // Roster teams only: a departed team can't win.
    const winnerTotals = knex('game_session_teams as gst')
      .leftJoin(answerTotals.as('ans'), function joinAnswers() {
        this.on('ans.game_session_id', 'gst.game_session_id').andOn(
          'ans.team_id',
          'gst.team_id',
        );
      })
      .leftJoin(bonusTotals.as('bonus'), function joinBonus() {
        this.on('bonus.game_session_id', 'gst.game_session_id').andOn(
          'bonus.team_id',
          'gst.team_id',
        );
      })
      .groupBy('gst.game_session_id')
      .select('gst.game_session_id as game_session_id')
      .select(
        knex.raw(
          'max(coalesce(ans.total, 0) + coalesce(bonus.total, 0)) as winner_total',
        ),
      );

    return knex
      .from(participantCounts.as('pc'))
      .leftJoin(winnerTotals.as('w'), 'w.game_session_id', 'pc.game_session_id')
      .select('pc.game_session_id as game_session_id')
      .select('pc.participant_count as participant_count')
      .select('w.winner_total as winner_total');
  }

  private async loadTeamTotals(
    gameSessionIds: readonly number[],
  ): Promise<TeamTotalsRow[]> {
    if (gameSessionIds.length === 0) return [];
    const knex = this.gameSessionTeams.getKnex();
    const ids = [...gameSessionIds];
    const participants = participantsQuery(knex, ids);
    const answerTotals = answerTotalsQuery(knex, ids);
    const bonusTotals = bonusTotalsQuery(knex, ids);

    return (await knex
      .from(participants.as('p'))
      .join('teams as t', 't.id', 'p.team_id')
      .leftJoin('game_session_teams as gst', function joinRoster() {
        this.on('gst.game_session_id', 'p.game_session_id').andOn(
          'gst.team_id',
          'p.team_id',
        );
      })
      .leftJoin(answerTotals.as('ans'), function joinAnswers() {
        this.on('ans.game_session_id', 'p.game_session_id').andOn(
          'ans.team_id',
          'p.team_id',
        );
      })
      .leftJoin(bonusTotals.as('bonus'), function joinBonus() {
        this.on('bonus.game_session_id', 'p.game_session_id').andOn(
          'bonus.team_id',
          'p.team_id',
        );
      })
      .select('p.game_session_id as gameSessionId')
      .select('t.id as teamId', 't.name as teamName')
      .select(knex.raw('(gst.team_id is not null) as "isOnRoster"'))
      .select(knex.raw('coalesce(ans.total, 0) as "quizPoints"'))
      .select(knex.raw('coalesce(bonus.total, 0) as "bonusPoints"'))
      .select(
        knex.raw('coalesce(bonus.positive_total, 0) as "positiveBonusPoints"'),
      )
      .select(
        knex.raw('coalesce(bonus.negative_total, 0) as "negativeBonusPoints"'),
      )) as TeamTotalsRow[];
  }

  /** Rounds belong to a session's *current* quiz, not necessarily the one any given answer was graded under (a mid-game re-import can swap it). */
  private async loadRounds(
    gameSessionIds: readonly number[],
  ): Promise<RoundRow[]> {
    if (gameSessionIds.length === 0) return [];
    const knex = this.gameSessionTeams.getKnex();
    return (await knex('rounds as r')
      .join('game_sessions as gs', 'gs.quiz_id', 'r.quiz_id')
      .whereIn('gs.id', [...gameSessionIds])
      .orderBy('r.order_index', 'asc')
      .select('gs.id as gameSessionId')
      .select('r.id as roundId', 'r.title as roundTitle')) as RoundRow[];
  }

  private async loadRoundTotals(
    gameSessionIds: readonly number[],
  ): Promise<RoundTotalRow[]> {
    if (gameSessionIds.length === 0) return [];
    const knex = this.gameSessionTeams.getKnex();
    return (await knex('answers as a')
      .join('questions as q', 'q.id', 'a.question_id')
      .whereIn('a.game_session_id', [...gameSessionIds])
      .groupBy('a.game_session_id', 'q.round_id', 'a.team_id')
      .select('a.game_session_id as gameSessionId')
      .select('q.round_id as roundId', 'a.team_id as teamId')
      .select(knex.raw('sum(a.points_awarded) as total'))) as RoundTotalRow[];
  }
}
