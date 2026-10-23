import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  formatAnswer,
  resolveAnswerKind,
  type AnswerKind,
  type QuestionType,
  type Verdict,
} from '@campus-pubquiz/types';
import { readQuestionPayload } from '@/db/question-payload';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { DISPLAY_NAME_SQL } from '@/ended-sessions-read/session-display-name';

type Knex = ReturnType<GameSessionTeamRepository['getKnex']>;

/** Narrows participants to some sessions and/or some teams; everything when omitted. */
export interface ParticipantScope {
  gameSessionIds?: readonly number[];
  teamIds?: readonly number[];
}

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

/** One question of an ended night, worded and numbered the way the screens show it. */
export interface NightQuestion {
  questionId: number;
  roundId: number;
  roundTitle: string;
  /** From 1, following round order. */
  roundNumber: number;
  /** From 1, restarting in each round. */
  questionNumber: number;
  orderIndex: number;
  prompt: string;
  type: QuestionType;
  answerKind: AnswerKind;
  points: number;
  /** The worded Answer key. */
  answer: string;
}

/** One stored answer of an ended night, worded the way the screens show it. */
export interface NightAnswer {
  questionId: number;
  teamId: number;
  teamName: string;
  verdict: Verdict | null;
  pointsAwarded: number;
  gradedAt: Date | null;
  responseMs: number | null;
  answer: string;
  /** The question is in the team's joker round: its points count double. */
  isJoker: boolean;
}

export interface Night {
  /** In play order. */
  questions: NightQuestion[];
  answers: NightAnswer[];
}

interface NightQuestionRow {
  questionId: number;
  roundId: number;
  roundTitle: string;
  orderIndex: number;
  prompt: string;
  type: QuestionType;
  answer: string;
  payload: unknown;
  points: string | number;
}

interface NightAnswerRow {
  questionId: number;
  teamId: number;
  teamName: string;
  verdict: Verdict | null;
  pointsAwarded: string | number;
  gradedAt: string | Date | null;
  responseMs: string | number | null;
  value: string;
}

type AnswerWording = Parameters<typeof formatAnswer>[1];

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
  let narrowed = query;
  if (scope?.gameSessionIds) {
    narrowed = narrowed.whereIn('game_session_id', [...scope.gameSessionIds]);
  }
  if (scope?.teamIds) {
    narrowed = narrowed.whereIn('team_id', [...scope.teamIds]);
  }
  return narrowed;
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
      .join(
        this.endedSessionsQuery().clearSelect().select('gs.id').as('ended_gs'),
        'ended_gs.id',
        'p.game_session_id',
      )
      .groupBy('p.team_id')
      .clearSelect()
      .select('p.team_id as team_id')
      .select(knex.raw('count(*) as sessions_played'));
  }

  /**
   * Ended sessions as a query to narrow, join, order and page. Tables are
   * aliased `gs` (game_sessions) and `qz` (quizzes); columns: `game_session_id`,
   * `join_code`, `quiz_id`, `display_name`, `custom_name`, `quiz_title` and
   * `played_at`. With `withMaxPoints`, also `max_points` (the sum of the points
   * of the session's quiz questions, 0 for none): a correlated subquery, so
   * only ask for it when it is read or sorted by.
   */
  endedSessionsQuery({ withMaxPoints = false } = {}) {
    const knex: Knex = this.gameSessionTeams.getKnex();
    const query = knex('game_sessions as gs')
      .join('quizzes as qz', 'qz.id', 'gs.quiz_id')
      .where('gs.status', 'ended')
      .select('gs.id as game_session_id')
      .select('gs.join_code as join_code')
      .select('gs.quiz_id as quiz_id')
      .select(knex.raw(`${DISPLAY_NAME_SQL} as display_name`))
      .select('gs.name as custom_name')
      .select('qz.title as quiz_title')
      .select('gs.created_at as played_at');
    return withMaxPoints
      ? query.select(
          knex.raw(
            `(select coalesce(sum(mq.points), 0) from rounds mr join questions mq on mq.round_id = mr.id where mr.quiz_id = gs.quiz_id) as max_points`,
          ),
        )
      : query;
  }

  /** One session's header by id; null if it doesn't exist or hasn't ended. */
  async endedSession(
    gameSessionId: number,
  ): Promise<EndedSessionHeader | null> {
    const row = (await this.endedSessionsQuery({ withMaxPoints: true })
      .where('gs.id', gameSessionId)
      .first()) as HeaderRow | undefined;
    return row ? headerOf(row) : null;
  }

  /** Every ended session each team took part in, newest first, session id breaking a tie. */
  async participations(
    teamIds: readonly number[],
  ): Promise<ParticipationRow[]> {
    if (teamIds.length === 0) return [];
    const rows = (await this.endedSessionsQuery({ withMaxPoints: true })
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

  /**
   * An ended night as the screens show it: the questions in play order (round
   * order, then question order; round and question numbers start at 1, the
   * question number restarting per round) and the stored answers, with the
   * Answer key and every answer worded by `formatAnswer`. With a team id only
   * that team's answers are read (narrowed in SQL). Questions come from the
   * session's quiz as it is now: that choice is made here and nowhere else.
   *
   * Trusts its caller: it checks neither the session's status nor that a team
   * took part. Call {@link endedSession} first (null means not ended) and, for
   * a team's own night, check the team took part.
   */
  async night(
    gameSessionId: number,
    { teamId }: { teamId?: number } = {},
  ): Promise<Night> {
    const knex: Knex = this.gameSessionTeams.getKnex();
    const questionRows = (await knex('game_sessions as gs')
      .join('rounds as r', 'r.quiz_id', 'gs.quiz_id')
      .join('questions as q', 'q.round_id', 'r.id')
      .where('gs.id', gameSessionId)
      .orderBy([
        { column: 'r.order_index', order: 'asc' },
        { column: 'r.id', order: 'asc' },
        { column: 'q.order_index', order: 'asc' },
        { column: 'q.id', order: 'asc' },
      ])
      .select(
        'q.id as questionId',
        'r.id as roundId',
        'r.title as roundTitle',
        'q.order_index as orderIndex',
        'q.prompt as prompt',
        'q.type as type',
        'q.answer as answer',
        'q.payload as payload',
        'q.points as points',
      )) as NightQuestionRow[];

    let answersQuery = knex('answers as a')
      .join('teams as t', 't.id', 'a.team_id')
      .where('a.game_session_id', gameSessionId);
    if (teamId !== undefined) {
      answersQuery = answersQuery.where('a.team_id', teamId);
    }
    const answerRows = (await answersQuery.select(
      'a.question_id as questionId',
      'a.team_id as teamId',
      't.name as teamName',
      'a.verdict as verdict',
      'a.points_awarded as pointsAwarded',
      'a.graded_at as gradedAt',
      'a.response_ms as responseMs',
      'a.value as value',
    )) as NightAnswerRow[];

    // Which round each team doubled: an answer to a question of it is a joker answer.
    let jokersQuery = knex('session_team_jokers').where(
      'game_session_id',
      gameSessionId,
    );
    if (teamId !== undefined) {
      jokersQuery = jokersQuery.where('team_id', teamId);
    }
    const jokerRows = (await jokersQuery.select(
      'team_id as teamId',
      'round_id as roundId',
    )) as { teamId: number; roundId: number }[];
    const jokerRoundByTeam = new Map(
      jokerRows.map((row) => [row.teamId, row.roundId]),
    );
    const roundIdByQuestion = new Map(
      questionRows.map((row) => [row.questionId, row.roundId]),
    );

    // One parse per question, shared by the key and every answer to it.
    const wordingById = new Map<number, AnswerWording>();
    const roundNumberById = new Map<number, number>();
    const questionCountByRound = new Map<number, number>();
    const questions = questionRows.map((row): NightQuestion => {
      const wording: AnswerWording = {
        type: row.type,
        options: readQuestionPayload({
          id: row.questionId,
          type: row.type,
          payload: row.payload,
        }).options,
      };
      wordingById.set(row.questionId, wording);
      if (!roundNumberById.has(row.roundId)) {
        roundNumberById.set(row.roundId, roundNumberById.size + 1);
      }
      const questionNumber = (questionCountByRound.get(row.roundId) ?? 0) + 1;
      questionCountByRound.set(row.roundId, questionNumber);
      return {
        questionId: row.questionId,
        roundId: row.roundId,
        roundTitle: row.roundTitle,
        roundNumber: roundNumberById.get(row.roundId)!,
        questionNumber,
        orderIndex: row.orderIndex,
        prompt: row.prompt,
        type: row.type,
        answerKind: resolveAnswerKind(row),
        points: Number(row.points),
        answer: formatAnswer(row.answer, wording),
      };
    });

    const answers = answerRows.map(
      (row): NightAnswer => ({
        questionId: row.questionId,
        teamId: row.teamId,
        teamName: row.teamName,
        verdict: row.verdict,
        pointsAwarded: Number(row.pointsAwarded),
        gradedAt: row.gradedAt === null ? null : new Date(row.gradedAt),
        responseMs: row.responseMs === null ? null : Number(row.responseMs),
        answer: formatAnswer(row.value, wordingById.get(row.questionId)!),
        isJoker:
          jokerRoundByTeam.get(row.teamId) ===
          roundIdByQuestion.get(row.questionId),
      }),
    );
    return { questions, answers };
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
