import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type {
  FunFactAnswer,
  FunFactBonusAward,
  FunFactData,
  FunFactPowerUp,
  LeaderboardEntry,
} from '@campus-pubquiz/types';
import {
  compareTeamNames,
  JOKER_MULTIPLIER,
  rankTeams,
} from '@campus-pubquiz/types';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { EndedSessionsRead } from '@/ended-sessions-read/ended-sessions-read';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import {
  sessionResult,
  type DepartedTeam,
  type SessionResult,
  type SessionResultAnswer,
  type SessionResultQuestion,
  type SessionStandings,
} from '@/standings/session-result';

export type { DepartedTeam, SessionStandings };

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

interface JokerRoundRow {
  gameSessionId: number;
  teamId: number;
  roundId: number;
}

/** SQL: the team bought an extra joker for the round of `q` in the session of `a`. */
const EXTRA_JOKER_ON_ROUND = `select 1 from purchases ex where ex.game_session_id = a.game_session_id and ex.team_id = a.team_id and ex.round_id = q.round_id and ex.power_up = 'extra_joker'`;

type Knex = ReturnType<GameSessionTeamRepository['getKnex']>;

/** Narrows a query to the given sessions; every session when no ids are given. */
function inSessions<Q extends { whereIn(column: string, ids: number[]): Q }>(
  query: Q,
  gameSessionIds: readonly number[] | undefined,
  column = 'game_session_id',
): Q {
  return gameSessionIds ? query.whereIn(column, [...gameSessionIds]) : query;
}

/**
 * The one step that adds up answer points: a team's points in each round of a
 * session (`game_session_id`, `round_id`, `team_id`, `total`). Every figure
 * built from answers' points (round points, quiz points, the winner's total)
 * reads this query, so a rule that changes what an answer counts for (the
 * joker, ADR 0004) is applied here and nowhere else.
 */
function roundPointsQuery(knex: Knex, gameSessionIds?: readonly number[]) {
  return (
    inSessions(
      knex('answers as a')
        .join('questions as q', 'q.id', 'a.question_id')
        .leftJoin('session_team_jokers as j', function joinJoker() {
          this.on('j.game_session_id', 'a.game_session_id')
            .andOn('j.team_id', 'a.team_id')
            .andOn('j.round_id', 'q.round_id');
        }),
      gameSessionIds,
      'a.game_session_id',
    )
      .groupBy('a.game_session_id', 'q.round_id', 'a.team_id')
      .select('a.game_session_id as game_session_id')
      .select('q.round_id as round_id', 'a.team_id as team_id')
      // The joker joins on the answer's own round, so it matches only a team's
      // joker round: that round's answer points count double (ADR 0004). A
      // bought extra joker for the round doubles it the same way, never more.
      .select(
        knex.raw(
          `sum(a.points_awarded * case when j.id is null and not exists (${EXTRA_JOKER_ON_ROUND}) then 1 else ?::int end) as total`,
          [JOKER_MULTIPLIER],
        ),
      )
  );
}

// The two totals are pre-aggregated as subqueries (rather than two leftJoins
// straight off the participants) so a team with several answers *and* several
// bonus awards doesn't fan out into a cross product that inflates both sums.
// A team's quiz points are the sum of its round points.
function answerTotalsQuery(knex: Knex, gameSessionIds?: readonly number[]) {
  return knex
    .from(roundPointsQuery(knex, gameSessionIds).as('rp'))
    .groupBy('rp.game_session_id', 'rp.team_id')
    .select('rp.game_session_id as game_session_id')
    .select('rp.team_id as team_id')
    .select(knex.raw('sum(rp.total) as total'));
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
 * Owns how teams are ordered and how ties are ranked. Who took part comes from
 * the Ended-sessions read; only roster teams are ranked. Totals are loaded
 * in SQL, ordering and tie ranks come from the shared ranking rule.
 */
@Injectable()
export class StandingsService {
  constructor(
    @InjectRepository(GameSessionTeam)
    private readonly gameSessionTeams: GameSessionTeamRepository,
    private readonly endedSessionsRead: EndedSessionsRead,
  ) {}

  /** Just the ranked roster — what every live-leaderboard refresh needs. */
  async leaderboard(gameSessionId: number): Promise<LeaderboardEntry[]> {
    return (await this.forSession(gameSessionId)).leaderboard;
  }

  /**
   * The session's answers (roster teams only, so a team that has left the
   * roster stays out of the fun facts and the reveal's teams-correct count)
   * and bonus awards, in the shape both are built from.
   */
  async funFactData(gameSessionId: number): Promise<FunFactData> {
    const knex = this.gameSessionTeams.getKnex();
    const [answerRows, bonusRows, powerUpRows] = await Promise.all([
      knex('answers as a')
        .join('game_session_teams as gst', function joinRoster() {
          this.on('gst.game_session_id', 'a.game_session_id').andOn(
            'gst.team_id',
            'a.team_id',
          );
        })
        .join('teams as t', 't.id', 'a.team_id')
        .where('a.game_session_id', gameSessionId)
        .select('a.question_id as questionId', 'a.team_id as teamId')
        .select('t.name as teamName', 'a.verdict as verdict')
        .select(
          'a.points_awarded as pointsAwarded',
          'a.response_ms as responseMs',
        ) as Promise<FunFactAnswer[]>,
      knex('bonus_awards')
        .where('game_session_id', gameSessionId)
        .select('category', 'points') as Promise<FunFactBonusAward[]>,
      knex('purchases')
        .where('game_session_id', gameSessionId)
        .select('team_id as teamId', 'power_up as powerUp')
        .select('question_id as questionId', 'cost') as Promise<
        FunFactPowerUp[]
      >,
    ]);
    return {
      powerUps: powerUpRows,
      answers: answerRows.map((row) => ({
        ...row,
        pointsAwarded: Number(row.pointsAwarded),
        responseMs: row.responseMs === null ? null : Number(row.responseMs),
      })),
      bonusAwards: bonusRows.map((row) => ({
        category: row.category,
        points: Number(row.points),
      })),
    };
  }

  /**
   * Whether the team took part in the session: on the roster now, or kicked or
   * departed with graded answers or bonus awards left behind.
   */
  async hasTakenPart(gameSessionId: number, teamId: number): Promise<boolean> {
    const participants = await this.endedSessionsRead.participants({
      gameSessionIds: [gameSessionId],
      teamIds: [teamId],
    });
    return participants.length > 0;
  }

  async forSession(gameSessionId: number): Promise<SessionStandings> {
    const bySession = await this.forSessions([gameSessionId]);
    return bySession.get(gameSessionId)!;
  }

  /** Standings for several sessions in a fixed number of queries, each session's own teams only. */
  async forSessions(
    gameSessionIds: readonly number[],
  ): Promise<Map<number, SessionStandings>> {
    const [teams, rounds, roundTotals, jokers] = await Promise.all([
      this.loadTeamTotals(gameSessionIds),
      this.loadRounds(gameSessionIds),
      this.loadRoundTotals(gameSessionIds),
      this.loadJokerRounds(gameSessionIds),
    ]);
    const doubledRounds = new Set(
      jokers.map((row) => `${row.gameSessionId}:${row.teamId}:${row.roundId}`),
    );

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
              isJoker: doubledRounds.has(
                `${gameSessionId}:${row.teamId}:${round.roundId}`,
              ),
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
   * The Session result of each ended session among the given ids (other
   * sessions are skipped, so they have no entry). Questions come from the
   * session's quiz; answers include those of teams that have left.
   */
  async resultsForSessions(
    gameSessionIds: readonly number[],
  ): Promise<Map<number, SessionResult>> {
    const results = new Map<number, SessionResult>();
    if (gameSessionIds.length === 0) return results;
    const knex = this.gameSessionTeams.getKnex();

    const endedRows = (await this.endedSessionsRead
      .endedSessionsQuery()
      .whereIn('gs.id', [...gameSessionIds])) as { game_session_id: number }[];
    const endedIds = endedRows.map((row) => row.game_session_id);
    if (endedIds.length === 0) return results;

    const [standings, questionRows, answerRows] = await Promise.all([
      this.forSessions(endedIds),
      knex('game_sessions as gs')
        .join('rounds as r', 'r.quiz_id', 'gs.quiz_id')
        .join('questions as q', 'q.round_id', 'r.id')
        .whereIn('gs.id', endedIds)
        .select('gs.id as gameSessionId', 'q.id as id', 'q.type as type')
        .select('q.points as points', 'r.id as roundId') as Promise<
        (SessionResultQuestion & { gameSessionId: number })[]
      >,
      knex('answers')
        .whereIn('game_session_id', endedIds)
        .select('game_session_id as gameSessionId')
        .select('question_id as questionId', 'team_id as teamId')
        .select('verdict', 'points_awarded as pointsAwarded') as Promise<
        (SessionResultAnswer & { gameSessionId: number })[]
      >,
    ]);

    for (const gameSessionId of endedIds) {
      results.set(
        gameSessionId,
        sessionResult({
          standings: standings.get(gameSessionId)!,
          questions: questionRows.filter(
            (row) => row.gameSessionId === gameSessionId,
          ),
          answers: answerRows
            .filter((row) => row.gameSessionId === gameSessionId)
            .map((row) => ({
              ...row,
              pointsAwarded: Number(row.pointsAwarded),
            })),
        }),
      );
    }
    return results;
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
      .from(this.endedSessionsRead.participantsQuery().as('p'))
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
    const participants = this.endedSessionsRead.participantsQuery({
      gameSessionIds: ids,
    });
    const answerTotals = answerTotalsQuery(knex, ids);
    const bonusTotals = bonusTotalsQuery(knex, ids);

    return (await knex
      .from(participants.as('p'))
      .join('teams as t', 't.id', 'p.team_id')
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
      .select('p.is_on_roster as isOnRoster')
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

  /** Each team's joker round per session, for the mark on its round cell. The points already carry the doubling. */
  private async loadJokerRounds(
    gameSessionIds: readonly number[],
  ): Promise<JokerRoundRow[]> {
    if (gameSessionIds.length === 0) return [];
    const knex = this.gameSessionTeams.getKnex();
    const doubled = (await knex('session_team_jokers')
      .whereIn('game_session_id', [...gameSessionIds])
      .select('game_session_id as gameSessionId')
      .select('team_id as teamId', 'round_id as roundId')) as JokerRoundRow[];
    const extra = (await knex('purchases')
      .whereIn('game_session_id', [...gameSessionIds])
      .where('power_up', 'extra_joker')
      .select('game_session_id as gameSessionId')
      .select('team_id as teamId', 'round_id as roundId')) as JokerRoundRow[];
    return [...doubled, ...extra];
  }

  private async loadRoundTotals(
    gameSessionIds: readonly number[],
  ): Promise<RoundTotalRow[]> {
    if (gameSessionIds.length === 0) return [];
    const knex = this.gameSessionTeams.getKnex();
    return (await knex
      .from(roundPointsQuery(knex, gameSessionIds).as('rp'))
      .select('rp.game_session_id as gameSessionId')
      .select('rp.round_id as roundId', 'rp.team_id as teamId')
      .select('rp.total as total')) as RoundTotalRow[];
  }
}
