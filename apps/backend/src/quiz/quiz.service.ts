import { Inject, Injectable } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { QuizSummary } from '@campus-pubquiz/types';
import { DRIZZLE } from '@/db/db.constants';
import * as schema from '@/db/schema';

interface QuestionPayload {
  options?: string[];
  answer: string;
}

function toSummaryPayload(payload: unknown): QuestionPayload {
  const { options, answer } = payload as QuestionPayload;
  return {
    ...(options !== undefined ? { options } : {}),
    answer,
  };
}

@Injectable()
export class QuizService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async list(): Promise<QuizSummary[]> {
    const quizzes = await this.db.query.quizzes.findMany({
      orderBy: (quizzesTable, { asc }) => asc(quizzesTable.createdAt),
      with: {
        rounds: {
          orderBy: (roundsTable, { asc }) => asc(roundsTable.orderIndex),
          with: {
            questions: {
              orderBy: (questionsTable, { asc }) =>
                asc(questionsTable.orderIndex),
            },
          },
        },
      },
    });

    return quizzes.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      rounds: quiz.rounds.map((round) => ({
        title: round.title,
        breakAfter: round.breakAfter,
        questions: round.questions.map((question) => ({
          id: question.id,
          prompt: question.prompt,
          ...toSummaryPayload(question.payload),
        })),
      })),
    }));
  }
}
