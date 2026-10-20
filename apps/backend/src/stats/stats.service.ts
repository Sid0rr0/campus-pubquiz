import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type { Knex } from '@mikro-orm/postgresql';
import { z } from 'zod';
import {
  MIN_RATINGS_FOR_RANKING,
  TREND_ROUNDS_LIMIT,
  type BonusCategory,
  type FeedbackTrends,
  type FeedbackTrendsRound,
  type PlayedSessionsListedPayload,
  type QuestionType,
  type SessionDetailFeedbackTopic,
  type SessionDetailStats,
  type SessionSettings,
  type Verdict,
} from '@campus-pubquiz/types';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';
import { PlayerCountService } from '@/player-count/player-count.service';
import { StandingsService } from '@/standings/standings.service';
import { summarisePlayerCounts } from '@/stats/player-count.calc';
import { computeSessionDetail } from '@/stats/session-detail.calc';
import { groupTopics } from '@/stats/session-feedback.calc';
import type {
  FeedbackTrendsQuery,
  PlayedSessionsQuery,
} from '@/stats/stats-query.schema';

interface PlayedSessionRow {
  gameSessionId: number;
  joinCode: string;
  quizTitle: string;
  name: string | null;
  playedAt: string | Date;
  maxPoints: string | number;
}

interface SessionHeaderRow {
  gameSessionId: number;
  joinCode: string;
  quizId: number;
  quizTitle: string;
  name: string | null;
  playedAt: string | Date;
  settings: Partial<SessionSettings>;
}

interface FeedbackTrendsRow {
  id: number;
  name: string | null;
  quizTitle: string;
  date: string | Date;
  average: string | number | null;
  count: string | number;
}

interface RankedRoundRow {
  sessionId: number;
  name: string | null;
  quizTitle: string;
  roundTitle: string;
  average: string | number;
  count: string | number;
}

interface SessionFeedbackRow {
  comment: string;
  topics: unknown;
  submittedAt: string | Date;
}

const storedTopicsSchema = z.array(z.string());

interface SessionRoundRow {
  roundId: number;
  title: string;
  category: string | null;
  orderIndex: number;
}

interface SessionRoundRatingRow {
  roundId: number;
  average: string | number;
  count: string | number;
}

interface SessionQuestionRow {
  questionId: number;
  roundId: number;
  orderIndex: number;
  prompt: string;
  type: QuestionType;
  points: string | number;
}

interface SessionAnswerRow {
  questionId: number;
  teamId: number;
  teamName: string;
  pointsAwarded: string | number;
  gradedAt: string | Date | null;
  verdict: Verdict | null;
  responseMs: string | number | null;
}

interface SessionBonusRow {
  teamId: number;
  category: BonusCategory;
  points: string | number;
}

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(GameSession)
    private readonly gameSessions: GameSessionRepository,
    private readonly standings: StandingsService,
    private readonly playerCountService: PlayerCountService,
  ) {}

  async listPlayedSessions({
    page,
    pageSize,
    sortBy,
    sortOrder,
  }: PlayedSessionsQuery): Promise<PlayedSessionsListedPayload> {
    const knex = this.gameSessions.getKnex();
    const offset = (page - 1) * pageSize;

    const maxPoints = knex('rounds as r')
      .join('questions as q', 'q.round_id', 'r.id')
      .groupBy('r.quiz_id')
      .select('r.quiz_id as quizId')
      .select(knex.raw('sum(q.points) as total'));

    // Team count and winner's total to sort by come from Standings, so the
    // sort uses the same participation and total rules as the numbers shown.
    // Who the winner *is* comes from Standings too, for the page only.
    const sessionTotals = this.standings.sessionTotalsQuery();

    const baseQuery = knex('game_sessions as gs')
      .join('quizzes as qz', 'qz.id', 'gs.quiz_id')
      .leftJoin(sessionTotals.as('st'), 'st.game_session_id', 'gs.id')
      .leftJoin(maxPoints.as('mp'), 'mp.quizId', 'gs.quiz_id')
      .where('gs.status', 'ended');

    // `winner` sorts on the winning total, with a session that has no
    // roster teams (null) treated as lower than any actual score.
    // `quizTitle` sorts on the resolved display name (custom name if set,
    // else the quiz's own title), matching what the "Session" column
    // actually shows.
    const orderColumn = {
      quizTitle: knex.raw('coalesce(gs.name, qz.title)'),
      playedAt: 'gs.created_at',
      teamCount: knex.raw('coalesce(st.participant_count, 0)'),
      maxPoints: knex.raw('coalesce(mp.total, 0)'),
      winner: knex.raw('coalesce(st.winner_total, -1)'),
    } satisfies Record<PlayedSessionsQuery['sortBy'], unknown>;

    const [rows, [{ count: total }]] = await Promise.all([
      baseQuery
        .clone()
        .select(
          'gs.id as gameSessionId',
          'gs.join_code as joinCode',
          'qz.title as quizTitle',
          'gs.name as name',
          'gs.created_at as playedAt',
        )
        .select(knex.raw('coalesce(mp.total, 0) as "maxPoints"'))
        .orderBy(orderColumn[sortBy], sortOrder)
        .orderBy('gs.id', 'desc')
        .limit(pageSize)
        .offset(offset) as Promise<PlayedSessionRow[]>,
      baseQuery.clone().count({ count: '*' }) as Promise<
        { count: string | number }[]
      >,
    ]);

    const standings = await this.standings.forSessions(
      rows.map((row) => row.gameSessionId),
    );

    const playerCounts = await this.playerCountService.listForSessions(
      rows.map((row) => row.gameSessionId),
    );

    return {
      items: rows.map((row) => {
        const sessionStandings = standings.get(row.gameSessionId)!;
        const sessionCounts = playerCounts.get(row.gameSessionId);
        const { total, reportedTeams } = summarisePlayerCounts(
          [...sessionStandings.leaderboard, ...sessionStandings.departed].map(
            (team) => sessionCounts?.get(team.teamId) ?? null,
          ),
        );
        return {
          gameSessionId: row.gameSessionId,
          joinCode: row.joinCode,
          quizTitle: row.quizTitle,
          name: this.displayName(row),
          playedAt: new Date(row.playedAt).toISOString(),
          teamCount: sessionStandings.participantCount,
          maxPoints: Number(row.maxPoints),
          winnerTeamName: sessionStandings.winner?.teamName ?? null,
          winnerPoints: sessionStandings.winner?.totalPoints ?? null,
          totalPlayers: reportedTeams > 0 ? total : null,
        };
      }),
      total: Number(total),
      page,
      pageSize,
    };
  }

  async getSessionDetail(gameSessionId: number): Promise<SessionDetailStats> {
    const knex = this.gameSessions.getKnex();

    const header = (await knex('game_sessions as gs')
      .join('quizzes as qz', 'qz.id', 'gs.quiz_id')
      .where('gs.id', gameSessionId)
      .where('gs.status', 'ended')
      .select(
        'gs.id as gameSessionId',
        'gs.join_code as joinCode',
        'gs.quiz_id as quizId',
        'qz.title as quizTitle',
        'gs.name as name',
        'gs.created_at as playedAt',
        'gs.settings as settings',
      )
      .first()) as SessionHeaderRow | undefined;
    if (!header) {
      throw new NotFoundException(
        `Ended session ${gameSessionId} does not exist`,
      );
    }

    const standings = await this.standings.forSession(gameSessionId);
    const playerCounts =
      (await this.playerCountService.listForSessions([gameSessionId])).get(
        gameSessionId,
      ) ?? new Map<number, number>();

    const rounds = (await knex('rounds as r')
      .where('r.quiz_id', header.quizId)
      .select(
        'r.id as roundId',
        'r.title',
        'r.category',
        'r.order_index as orderIndex',
      )) as SessionRoundRow[];

    // Aggregated in SQL so no row ever carries a team id — ratings stay anonymous.
    const roundRatings = (await knex('round_ratings')
      .where('game_session_id', gameSessionId)
      .groupBy('round_id')
      .select('round_id as roundId')
      .select(knex.raw('avg(stars) as average'))
      .select(knex.raw('count(*) as count'))) as SessionRoundRatingRow[];

    // Team columns are deliberately not selected: feedback stays anonymous.
    const feedback = (await knex('session_feedback')
      .where('game_session_id', gameSessionId)
      .orderBy([
        { column: 'updated_at', order: 'asc' },
        { column: 'id', order: 'asc' },
      ])
      .select(
        'comment',
        'topics',
        'updated_at as submittedAt',
      )) as SessionFeedbackRow[];

    const questions = (await knex('questions as q')
      .join('rounds as r', 'r.id', 'q.round_id')
      .where('r.quiz_id', header.quizId)
      .select(
        'q.id as questionId',
        'q.round_id as roundId',
        'q.order_index as orderIndex',
        'q.prompt',
        'q.type',
        'q.points',
      )) as SessionQuestionRow[];

    const answers = (await knex('answers as a')
      .join('teams as t', 't.id', 'a.team_id')
      .where('a.game_session_id', gameSessionId)
      .select(
        'a.question_id as questionId',
        'a.team_id as teamId',
        't.name as teamName',
        'a.points_awarded as pointsAwarded',
        'a.graded_at as gradedAt',
        'a.verdict as verdict',
        'a.response_ms as responseMs',
      )) as SessionAnswerRow[];

    const bonusAwards = (await knex('bonus_awards')
      .where('game_session_id', gameSessionId)
      .select('team_id as teamId', 'category', 'points')) as SessionBonusRow[];

    return computeSessionDetail({
      session: {
        gameSessionId: header.gameSessionId,
        joinCode: header.joinCode,
        quizTitle: header.quizTitle,
        name: this.displayName(header),
        playedAt: header.playedAt,
      },
      standings,
      playerCounts,
      rounds: rounds.map((r) => ({
        roundId: r.roundId,
        title: r.title,
        category: r.category,
        orderIndex: r.orderIndex,
      })),
      roundRatings: roundRatings.map((r) => ({
        roundId: r.roundId,
        average: Number(r.average),
        count: Number(r.count),
      })),
      // Sessions stored before the "Collect feedback" setting count as on.
      isFeedbackCollected: header.settings.collectFeedback ?? true,
      feedback: feedback.map((f) => ({
        comment: f.comment,
        topics: storedTopicsSchema.parse(f.topics),
        submittedAt: f.submittedAt,
      })),
      questions: questions.map((q) => ({
        questionId: q.questionId,
        roundId: q.roundId,
        orderIndex: q.orderIndex,
        prompt: q.prompt,
        type: q.type,
        points: Number(q.points),
      })),
      answers: answers.map((a) => ({
        questionId: a.questionId,
        teamId: a.teamId,
        teamName: a.teamName,
        pointsAwarded: Number(a.pointsAwarded),
        gradedAt: a.gradedAt,
        verdict: a.verdict,
        responseMs: a.responseMs === null ? null : Number(a.responseMs),
      })),
      bonusAwards: bonusAwards.map((b) => ({
        teamId: b.teamId,
        category: b.category,
        points: Number(b.points),
      })),
    });
  }

  /**
   * Anonymous feedback across ended sessions played in the range. Aggregated in
   * SQL so no row ever carries a team id. Sessions with "Collect feedback" off
   * are left out (stored-before-the-setting sessions count as on).
   */
  async getFeedbackTrends(query: FeedbackTrendsQuery): Promise<FeedbackTrends> {
    const knex = this.gameSessions.getKnex();
    if (query.leagueId !== undefined) {
      const leagues = (await knex('leagues')
        .where('id', query.leagueId)
        .select('id')) as { id: number }[];
      if (leagues.length === 0) {
        throw new NotFoundException(`League ${query.leagueId} does not exist`);
      }
    }
    const sessionsInRange = () => this.feedbackSessionsInRange(query);

    const rows = (await sessionsInRange()
      .join('quizzes as qz', 'qz.id', 'gs.quiz_id')
      .leftJoin('round_ratings as rr', 'rr.game_session_id', 'gs.id')
      .groupBy('gs.id', 'qz.title')
      .orderBy([
        { column: 'gs.created_at', order: 'asc' },
        { column: 'gs.id', order: 'asc' },
      ])
      .select(
        'gs.id as id',
        'gs.name as name',
        'qz.title as quizTitle',
        'gs.created_at as date',
      )
      .select(knex.raw('avg(rr.stars) as average'))
      .select(knex.raw('count(rr.id) as count'))) as FeedbackTrendsRow[];

    return {
      sessions: rows.map((row) => {
        const { average, count } = this.ratingOf(row);
        return {
          id: row.id,
          name: this.displayName(row),
          date: new Date(row.date).toISOString(),
          rating: count === 0 ? null : { average, count },
        };
      }),
      topics: await this.topicsAcross(sessionsInRange()),
      ...(await this.rankRounds(query)),
    };
  }

  /** A session's custom name if set, else its quiz's own title. */
  private displayName(row: { name: string | null; quizTitle: string }): string {
    return row.name ?? row.quizTitle;
  }

  /** A grouped rating row's average and count, as numbers (Postgres returns aggregates as strings). */
  private ratingOf(row: {
    average: string | number | null;
    count: string | number;
  }): { average: number; count: number } {
    return { average: Number(row.average), count: Number(row.count) };
  }

  /** Topic suggestions of the given sessions, oldest submission first into the shared grouping. No team column is selected. */
  private async topicsAcross(
    sessions: Knex.QueryBuilder,
  ): Promise<SessionDetailFeedbackTopic[]> {
    const knex = this.gameSessions.getKnex();
    const rows = (await knex('session_feedback as sf')
      .whereIn('sf.game_session_id', sessions.select('gs.id'))
      .orderBy([
        { column: 'sf.updated_at', order: 'asc' },
        { column: 'sf.id', order: 'asc' },
      ])
      .select('sf.topics')) as { topics: unknown }[];
    return groupTopics(rows.map((row) => storedTopicsSchema.parse(row.topics)));
  }

  /** Ended sessions with feedback on that are members of the league, or else whose date falls in the range (`gs` is the session table). */
  private feedbackSessionsInRange({ from, to, leagueId }: FeedbackTrendsQuery) {
    const knex = this.gameSessions.getKnex();
    const query = knex('game_sessions as gs')
      .where('gs.status', 'ended')
      .whereRaw(
        `coalesce((gs.settings ->> 'collectFeedback')::boolean, true) = true`,
      );
    if (leagueId !== undefined) {
      return query.whereIn(
        'gs.id',
        knex('league_sessions')
          .where('league_id', leagueId)
          .select('game_session_id'),
      );
    }
    if (from) query.where('gs.created_at', '>=', `${from}T00:00:00Z`);
    if (to) {
      query.whereRaw(
        `gs.created_at < (?::date + 1)::timestamp at time zone 'UTC'`,
        [to],
      );
    }
    return query;
  }

  /**
   * The best and worst rounds by average rating in the range, counting only
   * rounds with at least MIN_RATINGS_FOR_RANKING ratings. Ties: more ratings
   * first, then the newer session. No team column is selected.
   */
  private async rankRounds(
    range: FeedbackTrendsQuery,
  ): Promise<Pick<FeedbackTrends, 'bestRounds' | 'worstRounds'>> {
    const knex = this.gameSessions.getKnex();
    const ranked = (direction: 'asc' | 'desc') =>
      this.feedbackSessionsInRange(range)
        .join('quizzes as qz', 'qz.id', 'gs.quiz_id')
        .join('round_ratings as rr', 'rr.game_session_id', 'gs.id')
        .join('rounds as r', 'r.id', 'rr.round_id')
        .groupBy('gs.id', 'qz.title', 'r.id')
        .havingRaw('count(rr.id) >= ?', [MIN_RATINGS_FOR_RANKING])
        .orderByRaw(`avg(rr.stars) ${direction}`)
        .orderByRaw('count(rr.id) desc')
        .orderBy([
          { column: 'gs.created_at', order: 'desc' },
          { column: 'gs.id', order: 'desc' },
          { column: 'r.order_index', order: 'asc' },
        ])
        .limit(TREND_ROUNDS_LIMIT)
        .select(
          'gs.id as sessionId',
          'gs.name as name',
          'qz.title as quizTitle',
          'r.title as roundTitle',
        )
        .select(knex.raw('avg(rr.stars) as average'))
        .select(knex.raw('count(rr.id) as count'))
        .then((rows) =>
          (rows as RankedRoundRow[]).map(
            (row): FeedbackTrendsRound => ({
              sessionId: row.sessionId,
              sessionName: this.displayName(row),
              roundTitle: row.roundTitle,
              ...this.ratingOf(row),
            }),
          ),
        );
    const [bestRounds, worstRounds] = await Promise.all([
      ranked('desc'),
      ranked('asc'),
    ]);
    return { bestRounds, worstRounds };
  }

  /** Deletes an ended session and, via DB cascade rules, every answer, bonus award, and roster row tied to it. */
  async deleteSession(gameSessionId: number): Promise<void> {
    const session = await this.gameSessions.findOne({ id: gameSessionId });
    if (!session || session.status !== 'ended') {
      throw new NotFoundException(
        `Ended session ${gameSessionId} does not exist`,
      );
    }
    await this.gameSessions.getEntityManager().removeAndFlush(session);
  }

  /** Sets an ended session's custom display name — a blank name clears it, falling back to showing the quiz's own title instead. */
  async renameSession(gameSessionId: number, name: string): Promise<void> {
    const session = await this.gameSessions.findOne({ id: gameSessionId });
    if (!session || session.status !== 'ended') {
      throw new NotFoundException(
        `Ended session ${gameSessionId} does not exist`,
      );
    }
    session.name = name.trim() || null;
    await this.gameSessions.getEntityManager().flush();
  }
}
