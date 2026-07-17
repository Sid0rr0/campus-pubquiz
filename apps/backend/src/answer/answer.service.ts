import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type {
  AnswerView,
  LeaderboardEntry,
  TeamAnswerView,
} from '@campus-pubquiz/types';
import { DRIZZLE } from '@/db/db.constants';
import * as schema from '@/db/schema';

export interface SubmittedAnswer {
  answerId: string;
  teamId: string;
  teamName: string;
  value: string;
}

export interface GradedAnswer {
  questionId: string;
}

@Injectable()
export class AnswerService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async submit(
    gameSessionId: string,
    questionId: string,
    teamId: string,
    value: string,
  ): Promise<SubmittedAnswer> {
    const [answer] = await this.db
      .insert(schema.answers)
      .values({ gameSessionId, questionId, teamId, value })
      .onConflictDoUpdate({
        target: [
          schema.answers.gameSessionId,
          schema.answers.questionId,
          schema.answers.teamId,
        ],
        set: { value, updatedAt: new Date() },
      })
      .returning();

    const [team] = await this.db
      .select({ name: schema.teams.name })
      .from(schema.teams)
      .where(eq(schema.teams.id, teamId));

    return {
      answerId: answer.id,
      teamId,
      teamName: team.name,
      value: answer.value,
    };
  }

  async listForQuestion(
    gameSessionId: string,
    questionId: string,
  ): Promise<AnswerView[]> {
    return this.db
      .select({
        answerId: schema.answers.id,
        teamId: schema.answers.teamId,
        teamName: schema.teams.name,
        value: schema.answers.value,
        pointsAwarded: schema.answers.pointsAwarded,
      })
      .from(schema.answers)
      .innerJoin(schema.teams, eq(schema.answers.teamId, schema.teams.id))
      .where(
        and(
          eq(schema.answers.gameSessionId, gameSessionId),
          eq(schema.answers.questionId, questionId),
        ),
      )
      .orderBy(asc(schema.teams.name));
  }

  async listForTeam(
    gameSessionId: string,
    teamId: string,
  ): Promise<TeamAnswerView[]> {
    return this.db
      .select({
        questionId: schema.answers.questionId,
        value: schema.answers.value,
      })
      .from(schema.answers)
      .where(
        and(
          eq(schema.answers.gameSessionId, gameSessionId),
          eq(schema.answers.teamId, teamId),
        ),
      );
  }

  async grade(answerId: string, pointsAwarded: number): Promise<GradedAnswer> {
    const [answer] = await this.db
      .update(schema.answers)
      .set({ pointsAwarded, gradedAt: new Date() })
      .where(eq(schema.answers.id, answerId))
      .returning();

    return { questionId: answer.questionId };
  }

  async computeLeaderboard(gameSessionId: string): Promise<LeaderboardEntry[]> {
    const totalPoints = sql<number>`coalesce(sum(${schema.answers.pointsAwarded}), 0)`;

    const rows = await this.db
      .select({
        teamId: schema.teams.id,
        teamName: schema.teams.name,
        totalPoints,
      })
      .from(schema.teams)
      .leftJoin(schema.answers, eq(schema.answers.teamId, schema.teams.id))
      .where(eq(schema.teams.gameSessionId, gameSessionId))
      .groupBy(schema.teams.id, schema.teams.name)
      .orderBy(desc(totalPoints), asc(schema.teams.name));

    return rows.map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      totalPoints: Number(row.totalPoints),
    }));
  }
}
