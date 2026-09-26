import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type { PlayedSessionStats } from '@campus-pubquiz/types';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';

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
}
