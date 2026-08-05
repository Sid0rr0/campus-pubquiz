import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type { QuizSummary } from '@campus-pubquiz/types';
import { Quiz } from '@/db/entities/quiz.entity';
import { QuizRepository } from '@/db/repositories/quiz.repository';

interface QuestionPayload {
  options?: string[];
}

function toSummaryPayload(payload: unknown): QuestionPayload {
  const { options } = payload as QuestionPayload;
  return {
    ...(options !== undefined ? { options } : {}),
  };
}

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(Quiz) private readonly quizzes: QuizRepository,
  ) {}

  /** Titles for the given quiz ids, for the session picker — GameStateService knows quizId but not quiz metadata. */
  async findTitles(quizIds: number[]): Promise<Map<number, string>> {
    if (quizIds.length === 0) return new Map();
    const quizzes = await this.quizzes.find({ id: { $in: quizIds } });
    return new Map(quizzes.map((quiz) => [quiz.id, quiz.title]));
  }

  async list(): Promise<QuizSummary[]> {
    const quizzes = await this.quizzes.findAllWithRoundsAndQuestions();

    return quizzes.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      rounds: quiz.rounds.getItems().map((round) => ({
        title: round.title,
        breakAfter: round.breakAfter,
        questions: round.questions.getItems().map((question) => ({
          id: question.id,
          prompt: question.prompt,
          answer: question.answer,
          ...toSummaryPayload(question.payload),
        })),
      })),
    }));
  }
}
