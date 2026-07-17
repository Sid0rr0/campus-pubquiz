import { Inject, Injectable } from '@nestjs/common';
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
}
