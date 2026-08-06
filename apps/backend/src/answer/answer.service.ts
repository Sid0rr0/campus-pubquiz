import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type {
  AnswerView,
  LeaderboardEntry,
  TeamAnswerView,
} from '@campus-pubquiz/types';
import { Answer } from '@/db/entities/answer.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Team } from '@/db/entities/team.entity';
import { AnswerRepository } from '@/db/repositories/answer.repository';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { TeamRepository } from '@/db/repositories/team.repository';

export interface SubmittedAnswer {
  answerId: number;
  teamId: number;
  teamName: string;
  value: string;
}

export interface GradedAnswer {
  questionId: number;
}

interface LeaderboardRow {
  teamId: number;
  teamName: string;
  quizPoints: string | number;
  bonusPoints: string | number;
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

@Injectable()
export class AnswerService {
  constructor(
    @InjectRepository(Answer) private readonly answers: AnswerRepository,
    @InjectRepository(Team) private readonly teams: TeamRepository,
    @InjectRepository(GameSessionTeam)
    private readonly gameSessionTeams: GameSessionTeamRepository,
  ) {}

  async submit(
    gameSessionId: number,
    questionId: number,
    teamId: number,
    value: string,
  ): Promise<SubmittedAnswer> {
    // upsert() bypasses the @Property({ onCreate/onUpdate }) hooks — set the
    // timestamps explicitly (see TeamService.addToRoster for the same fix).
    const now = new Date();
    const answer = await this.answers.upsert(
      {
        gameSession: gameSessionId,
        question: questionId,
        team: teamId,
        value,
        createdAt: now,
        updatedAt: now,
      },
      {
        onConflictFields: ['gameSession', 'question', 'team'],
        onConflictAction: 'merge',
        onConflictMergeFields: ['value', 'updatedAt'],
      },
    );

    const team = await this.teams.findOneOrFail(teamId, { fields: ['name'] });

    return {
      answerId: answer.id,
      teamId,
      teamName: team.name,
      value: answer.value,
    };
  }

  async listForQuestion(
    gameSessionId: number,
    questionId: number,
  ): Promise<AnswerView[]> {
    const rows = await this.answers.find(
      { gameSession: gameSessionId, question: questionId },
      { populate: ['team'], orderBy: { team: { name: 'asc' } } },
    );
    return rows.map((row) => ({
      answerId: row.id,
      teamId: row.team.id,
      teamName: row.team.name,
      value: row.value,
      pointsAwarded: row.pointsAwarded,
      gradedAt: row.gradedAt?.toISOString() ?? null,
    }));
  }

  async listForTeam(
    gameSessionId: number,
    teamId: number,
  ): Promise<TeamAnswerView[]> {
    const rows = await this.answers.find({
      gameSession: gameSessionId,
      team: teamId,
    });
    return rows.map((row) => ({
      questionId: row.question.id,
      value: row.value,
    }));
  }

  async grade(answerId: number, pointsAwarded: number): Promise<GradedAnswer> {
    const answer = await this.answers.findOneOrFail(answerId);
    answer.pointsAwarded = pointsAwarded;
    answer.gradedAt = new Date();
    await this.answers.getEntityManager().flush();
    return { questionId: answer.question.id };
  }

  async computeLeaderboard(gameSessionId: number): Promise<LeaderboardEntry[]> {
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
      .select(knex.raw('sum(points) as total'));

    const rows = (await knex('game_session_teams as gst')
      .join('teams as t', 't.id', 'gst.team_id')
      .leftJoin(answerTotals.as('ans'), 'ans.team_id', 't.id')
      .leftJoin(bonusTotals.as('bonus'), 'bonus.team_id', 't.id')
      .where('gst.game_session_id', gameSessionId)
      .select('t.id as teamId', 't.name as teamName')
      .select(knex.raw('coalesce(ans.total, 0) as "quizPoints"'))
      .select(knex.raw('coalesce(bonus.total, 0) as "bonusPoints"'))
      .orderBy([
        {
          column: knex.raw('coalesce(ans.total, 0) + coalesce(bonus.total, 0)'),
          order: 'desc',
        },
        { column: 't.name', order: 'asc' },
      ])) as LeaderboardRow[];

    // Rounds belong to the session's *current* quiz, not necessarily the one
    // any given answer was graded under (a mid-game re-import can swap it).
    const rounds = (await knex('rounds as r')
      .join('game_sessions as gs', 'gs.quiz_id', 'r.quiz_id')
      .where('gs.id', gameSessionId)
      .orderBy('r.order_index', 'asc')
      .select('r.id as roundId', 'r.title as roundTitle')) as RoundRow[];

    const roundTotals = (await knex('answers as a')
      .join('questions as q', 'q.id', 'a.question_id')
      .where('a.game_session_id', gameSessionId)
      .groupBy('q.round_id', 'a.team_id')
      .select('q.round_id as roundId', 'a.team_id as teamId')
      .select(knex.raw('sum(a.points_awarded) as total'))) as RoundTotalRow[];

    return rows.map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      totalPoints: Number(row.quizPoints) + Number(row.bonusPoints),
      bonusPoints: Number(row.bonusPoints),
      roundPoints: rounds.map((round) => ({
        roundTitle: round.roundTitle,
        points: Number(
          roundTotals.find(
            (total) =>
              total.roundId === round.roundId && total.teamId === row.teamId,
          )?.total ?? 0,
        ),
      })),
    }));
  }
}
