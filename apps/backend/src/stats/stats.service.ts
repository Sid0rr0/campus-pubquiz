import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type { Knex } from '@mikro-orm/postgresql';
import { z } from 'zod';
import {
  classifyMediaUrl,
  MIN_RATINGS_FOR_RANKING,
  TREND_ROUNDS_LIMIT,
  type BonusCategory,
  type FeedbackTrends,
  type FeedbackTrendsRound,
  type PlayedSessionsListedPayload,
  type SessionDetailFeedbackTopic,
  type SessionDetailStats,
  type SessionSettings,
} from '@campus-pubquiz/types';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';
import { EndedSessionsRead } from '@/ended-sessions-read/ended-sessions-read';
import { PlayerCountService } from '@/player-count/player-count.service';
import { StandingsService } from '@/standings/standings.service';
import { summarisePlayerCounts } from '@/stats/player-count.calc';
import {
  briefMediaKind,
  computeSessionBrief,
  type SessionBriefInput,
  type SessionBriefQuestionInputRow,
  type SessionBriefRoundInputRow,
} from '@/stats/session-brief.calc';
import {
  computeSessionDetail,
  type SessionDetailInput,
} from '@/stats/session-detail.calc';
import { readQuestionPayload } from '@/db/question-payload';
import { groupTopics } from '@/stats/session-feedback.calc';
import type {
  FeedbackTrendsQuery,
  PlayedSessionsQuery,
} from '@/stats/stats-query.schema';

interface PlayedSessionRow {
  game_session_id: number;
  join_code: string;
  quiz_title: string;
  display_name: string;
  played_at: string | Date;
  max_points: string | number;
}

interface FeedbackTrendsRow {
  game_session_id: number;
  display_name: string;
  played_at: string | Date;
  average: string | number | null;
  count: string | number;
}

interface RankedRoundRow {
  game_session_id: number;
  display_name: string;
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
    private readonly endedSessions: EndedSessionsRead,
  ) {}

  async listPlayedSessions({
    page,
    pageSize,
    sortBy,
    sortOrder,
  }: PlayedSessionsQuery): Promise<PlayedSessionsListedPayload> {
    const knex = this.gameSessions.getKnex();
    const offset = (page - 1) * pageSize;

    // Team count and winner's total to sort by come from Standings, so the
    // sort uses the same participation and total rules as the numbers shown.
    // Who the winner *is* comes from Standings too, for the page only.
    const sessionTotals = this.standings.sessionTotalsQuery();

    const baseQuery = this.endedSessions
      .endedSessionsQuery({ withMaxPoints: true })
      .leftJoin(sessionTotals.as('st'), 'st.game_session_id', 'gs.id');

    // `winner` sorts on the winning total, with a session that has no
    // roster teams (null) treated as lower than any actual score.
    // `quizTitle` sorts on the display name the "Session" column shows.
    const orderColumn = {
      quizTitle: 'display_name',
      playedAt: 'gs.created_at',
      teamCount: knex.raw('coalesce(st.participant_count, 0)'),
      maxPoints: 'max_points',
      winner: knex.raw('coalesce(st.winner_total, -1)'),
    } satisfies Record<PlayedSessionsQuery['sortBy'], unknown>;

    const [rows, [{ count: total }]] = await Promise.all([
      baseQuery
        .clone()
        .orderBy(orderColumn[sortBy], sortOrder)
        .orderBy('gs.id', 'desc')
        .limit(pageSize)
        .offset(offset) as Promise<PlayedSessionRow[]>,
      baseQuery.clone().clearSelect().count({ count: '*' }) as Promise<
        { count: string | number }[]
      >,
    ]);

    const standings = await this.standings.forSessions(
      rows.map((row) => row.game_session_id),
    );

    const playerCounts = await this.playerCountService.listForSessions(
      rows.map((row) => row.game_session_id),
    );

    return {
      items: rows.map((row) => {
        const sessionStandings = standings.get(row.game_session_id)!;
        const sessionCounts = playerCounts.get(row.game_session_id);
        const { total, reportedTeams } = summarisePlayerCounts(
          [...sessionStandings.leaderboard, ...sessionStandings.departed].map(
            (team) => sessionCounts?.get(team.teamId) ?? null,
          ),
        );
        return {
          gameSessionId: row.game_session_id,
          joinCode: row.join_code,
          quizTitle: row.quiz_title,
          name: row.display_name,
          playedAt: new Date(row.played_at).toISOString(),
          teamCount: sessionStandings.participantCount,
          maxPoints: Number(row.max_points),
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
    return computeSessionDetail(await this.loadSessionRows(gameSessionId));
  }

  /**
   * The Night brief of an ended session: the same rows the session detail is
   * computed from, plus the round and question columns only the brief reads.
   * No team column beyond what Standings and the answers already carry is read,
   * and the calc never writes any of them.
   */
  async getSessionBrief(
    gameSessionId: number,
    timeZone?: string,
  ): Promise<string> {
    const knex = this.gameSessions.getKnex();
    const rows = await this.loadSessionRows(gameSessionId);

    const roundExtras = (await knex('rounds as r')
      .join('game_sessions as gs', 'gs.quiz_id', 'r.quiz_id')
      .where('gs.id', gameSessionId)
      .select(
        'r.id as roundId',
        'r.author',
        'r.note',
        'r.kahoot_mode as isKahoot',
      )) as Pick<
      SessionBriefRoundInputRow,
      'roundId' | 'author' | 'note' | 'isKahoot'
    >[];
    const roundExtrasById = new Map(roundExtras.map((r) => [r.roundId, r]));

    const questionExtras = (await knex('questions as q')
      .join('rounds as r', 'r.id', 'q.round_id')
      .join('game_sessions as gs', 'gs.quiz_id', 'r.quiz_id')
      .where('gs.id', gameSessionId)
      .select('q.id as questionId', 'q.type', 'q.notes', 'q.payload')) as (Pick<
      SessionBriefQuestionInputRow,
      'questionId' | 'type' | 'notes'
    > & { payload: unknown })[];
    const questionExtrasById = new Map(
      questionExtras.map((q) => {
        const payload = readQuestionPayload({
          id: q.questionId,
          type: q.type,
          payload: q.payload,
        });
        return [
          q.questionId,
          {
            notes: q.notes,
            options: payload.options,
            media: {
              question: briefMediaKind(classifyMediaUrl(payload.mediaUrl)),
              answer: briefMediaKind(classifyMediaUrl(payload.answerMediaUrl)),
            },
          },
        ];
      }),
    );

    // Every question the session opened; null for a session saved before that was tracked.
    const { openedQuestionIds } = (await knex('game_sessions')
      .where('id', gameSessionId)
      .select('opened_question_ids as openedQuestionIds')
      .first()) as Pick<SessionBriefInput, 'openedQuestionIds'>;

    return computeSessionBrief({
      ...rows,
      rounds: rows.rounds.map((round) => {
        const extras = roundExtrasById.get(round.roundId);
        return {
          ...round,
          author: extras?.author ?? null,
          note: extras?.note ?? null,
          isKahoot: extras?.isKahoot ?? false,
        };
      }),
      questions: rows.questions.map((question) => {
        const extras = questionExtrasById.get(question.questionId);
        return {
          ...question,
          notes: extras?.notes ?? null,
          options: extras?.options,
          media: extras?.media ?? {},
        };
      }),
      openedQuestionIds,
      timeZone,
    });
  }

  /** The stored rows of one ended session, as both the session detail and the Night brief read them. */
  private async loadSessionRows(
    gameSessionId: number,
  ): Promise<SessionDetailInput> {
    const knex = this.gameSessions.getKnex();

    const header = await this.endedSessions.endedSession(gameSessionId);
    if (!header) {
      throw new NotFoundException(
        `Ended session ${gameSessionId} does not exist`,
      );
    }
    const { settings } = (await knex('game_sessions')
      .where('id', gameSessionId)
      .select('settings')
      .first()) as { settings: Partial<SessionSettings> };

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

    const { questions, answers } =
      await this.endedSessions.night(gameSessionId);

    const bonusAwards = (await knex('bonus_awards')
      .where('game_session_id', gameSessionId)
      .select('team_id as teamId', 'category', 'points')) as SessionBonusRow[];

    return {
      session: {
        gameSessionId: header.gameSessionId,
        joinCode: header.joinCode,
        quizTitle: header.quizTitle,
        name: header.displayName,
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
      isFeedbackCollected: settings.collectFeedback ?? true,
      feedback: feedback.map((f) => ({
        comment: f.comment,
        topics: storedTopicsSchema.parse(f.topics),
        submittedAt: f.submittedAt,
      })),
      questions,
      answers,
      bonusAwards: bonusAwards.map((b) => ({
        teamId: b.teamId,
        category: b.category,
        points: Number(b.points),
      })),
    };
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
      .leftJoin('round_ratings as rr', 'rr.game_session_id', 'gs.id')
      .groupBy('gs.id', 'qz.title')
      .orderBy([
        { column: 'gs.created_at', order: 'asc' },
        { column: 'gs.id', order: 'asc' },
      ])
      .select(knex.raw('avg(rr.stars) as average'))
      .select(knex.raw('count(rr.id) as count'))) as FeedbackTrendsRow[];

    return {
      sessions: rows.map((row) => {
        const { average, count } = this.ratingOf(row);
        return {
          id: row.game_session_id,
          name: row.display_name,
          date: new Date(row.played_at).toISOString(),
          rating: count === 0 ? null : { average, count },
        };
      }),
      topics: await this.topicsAcross(sessionsInRange()),
      ...(await this.rankRounds(query)),
    };
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
      .whereIn('sf.game_session_id', sessions.clearSelect().select('gs.id'))
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
    const query = this.endedSessions
      .endedSessionsQuery()
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
        .select('r.title as roundTitle')
        .select(knex.raw('avg(rr.stars) as average'))
        .select(knex.raw('count(rr.id) as count'))
        .then((rows) =>
          (rows as RankedRoundRow[]).map(
            (row): FeedbackTrendsRound => ({
              sessionId: row.game_session_id,
              sessionName: row.display_name,
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

  /** Sets an ended session's custom display name — a blank name clears it, falling back to showing the quiz's own title instead. Returns the stored name (null when cleared). */
  async renameSession(
    gameSessionId: number,
    name: string,
  ): Promise<string | null> {
    const session = await this.gameSessions.findOne({ id: gameSessionId });
    if (!session || session.status !== 'ended') {
      throw new NotFoundException(
        `Ended session ${gameSessionId} does not exist`,
      );
    }
    session.name = name.trim() || null;
    await this.gameSessions.getEntityManager().flush();
    return session.name;
  }
}
