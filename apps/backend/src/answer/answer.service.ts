import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AnswerView } from '@campus-pubquiz/types';
import { DRIZZLE } from '@/db/db.constants';
import * as schema from '@/db/schema';

export interface SubmittedAnswer {
  answerId: string;
  teamId: string;
  teamName: string;
  value: string;
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
}
