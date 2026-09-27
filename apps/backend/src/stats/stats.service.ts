import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type {
  BonusCategory,
  PlayedSessionStats,
  QuestionType,
  SessionDetailStats,
} from '@campus-pubquiz/types';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';
import { computeSessionDetail } from '@/stats/session-detail.calc';

interface PlayedSessionRow {
  gameSessionId: number;
  joinCode: string;
  quizTitle: string;
  playedAt: string | Date;
  teamCount: string | number;
  maxPoints: string | number;
  winnerTeamName: string | null;
  winnerAnswerPoints: string | number | null;
}

interface SessionHeaderRow {
  gameSessionId: number;
  joinCode: string;
  quizId: number;
  quizTitle: string;
  playedAt: string | Date;
}

interface SessionTeamRow {
  teamId: number;
  teamName: string;
}

interface SessionRoundRow {
  roundId: number;
  title: string;
  category: string | null;
  orderIndex: number;
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
  ) {}

  async listPlayedSessions(): Promise<PlayedSessionStats[]> {
    const knex = this.gameSessions.getKnex();

    const teamCounts = knex('game_session_teams')
      .groupBy('game_session_id')
      .select('game_session_id')
      .select(knex.raw('count(*) as count'));

    const maxPoints = knex('rounds as r')
      .join('questions as q', 'q.round_id', 'r.id')
      .groupBy('r.quiz_id')
      .select('r.quiz_id as quizId')
      .select(knex.raw('sum(q.points) as total'));

    // Pre-aggregated per (session, team), same reasoning as
    // AnswerService.computeLeaderboard — joining straight off
    // game_session_teams would fan out a team with several answers *and*
    // several bonus awards.
    const answerTotals = knex('answers')
      .groupBy(['game_session_id', 'team_id'])
      .select('game_session_id', 'team_id')
      .select(knex.raw('sum(points_awarded) as total'));

    const bonusTotals = knex('bonus_awards')
      .groupBy(['game_session_id', 'team_id'])
      .select('game_session_id', 'team_id')
      .select(knex.raw('sum(points) as total'));

    // One row per session: the leaderboard winner (same ranking as
    // AnswerService.computeLeaderboard — total incl. bonus desc, name asc),
    // but only that team's answer points are carried through.
    const winners = knex('game_session_teams as gst')
      .join('teams as t', 't.id', 'gst.team_id')
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
      .distinctOn('gst.game_session_id')
      .select('gst.game_session_id as gameSessionId', 't.name as teamName')
      .select(knex.raw('coalesce(ans.total, 0) as "answerPoints"'))
      .orderBy([
        { column: 'gst.game_session_id' },
        {
          column: knex.raw('coalesce(ans.total, 0) + coalesce(bonus.total, 0)'),
          order: 'desc',
        },
        { column: 't.name', order: 'asc' },
      ]);

    const rows = (await knex('game_sessions as gs')
      .join('quizzes as qz', 'qz.id', 'gs.quiz_id')
      .leftJoin(teamCounts.as('tc'), 'tc.game_session_id', 'gs.id')
      .leftJoin(maxPoints.as('mp'), 'mp.quizId', 'gs.quiz_id')
      .leftJoin(winners.as('w'), 'w.gameSessionId', 'gs.id')
      .where('gs.status', 'ended')
      .select(
        'gs.id as gameSessionId',
        'gs.join_code as joinCode',
        'qz.title as quizTitle',
        'gs.created_at as playedAt',
      )
      .select(knex.raw('coalesce(tc.count, 0) as "teamCount"'))
      .select(knex.raw('coalesce(mp.total, 0) as "maxPoints"'))
      .select('w.teamName as winnerTeamName')
      .select('w.answerPoints as winnerAnswerPoints')
      .orderBy('gs.created_at', 'desc')) as PlayedSessionRow[];

    return rows.map((row) => ({
      gameSessionId: row.gameSessionId,
      joinCode: row.joinCode,
      quizTitle: row.quizTitle,
      playedAt: new Date(row.playedAt).toISOString(),
      teamCount: Number(row.teamCount),
      maxPoints: Number(row.maxPoints),
      winnerTeamName: row.winnerTeamName,
      winnerAnswerPoints:
        row.winnerAnswerPoints === null ? null : Number(row.winnerAnswerPoints),
    }));
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
        'gs.created_at as playedAt',
      )
      .first()) as SessionHeaderRow | undefined;
    if (!header) {
      throw new NotFoundException(
        `Ended session ${gameSessionId} does not exist`,
      );
    }

    // Kicking a team or a team leaving mid-session hard-deletes its
    // game_session_teams roster row (TeamService.removeFromRoster), but its
    // already-graded answers/bonuses stay — so the roster alone would
    // undercount teamCount and inflate correctRate/pointsPercent past 100%
    // for anyone who answered before being removed. Union in every team that
    // left a mark on this session, not just the current roster.
    const teamIdsInSession = knex('game_session_teams')
      .where('game_session_id', gameSessionId)
      .select('team_id')
      .union([
        knex('answers')
          .where('game_session_id', gameSessionId)
          .select('team_id'),
        knex('bonus_awards')
          .where('game_session_id', gameSessionId)
          .select('team_id'),
      ]);

    const teams = (await knex('teams as t')
      .whereIn('t.id', teamIdsInSession)
      .select('t.id as teamId', 't.name as teamName')) as SessionTeamRow[];

    const rounds = (await knex('rounds as r')
      .where('r.quiz_id', header.quizId)
      .select(
        'r.id as roundId',
        'r.title',
        'r.category',
        'r.order_index as orderIndex',
      )) as SessionRoundRow[];

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
        playedAt: header.playedAt,
      },
      teams,
      rounds: rounds.map((r) => ({
        roundId: r.roundId,
        title: r.title,
        category: r.category,
        orderIndex: r.orderIndex,
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
        responseMs: a.responseMs === null ? null : Number(a.responseMs),
      })),
      bonusAwards: bonusAwards.map((b) => ({
        teamId: b.teamId,
        category: b.category,
        points: Number(b.points),
      })),
    });
  }
}
