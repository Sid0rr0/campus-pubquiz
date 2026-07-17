import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { QuizSummary } from '@campus-pubquiz/types';
import { DRIZZLE } from '@/db/db.constants';
import * as schema from '@/db/schema';

@Injectable()
export class QuizService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async list(): Promise<QuizSummary[]> {
    return this.db
      .select({ id: schema.quizzes.id, title: schema.quizzes.title })
      .from(schema.quizzes)
      .orderBy(schema.quizzes.createdAt);
  }

  async assignToSession(gameSessionId: string, quizId: string): Promise<void> {
    await this.db
      .update(schema.gameSessions)
      .set({ quizId })
      .where(eq(schema.gameSessions.id, gameSessionId));
  }
}
