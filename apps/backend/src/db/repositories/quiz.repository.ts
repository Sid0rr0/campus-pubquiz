import { EntityRepository } from '@mikro-orm/postgresql';
import type { Quiz } from '@/db/entities/quiz.entity';

export class QuizRepository extends EntityRepository<Quiz> {
  findAllWithRoundsAndQuestions(): Promise<Quiz[]> {
    return this.find(
      {},
      {
        populate: ['rounds', 'rounds.questions'],
        orderBy: {
          createdAt: 'asc',
          rounds: { orderIndex: 'asc', questions: { orderIndex: 'asc' } },
        },
      },
    );
  }

  findByIdWithRoundsAndQuestions(id: number): Promise<Quiz | null> {
    return this.findOne(
      { id },
      {
        populate: ['rounds', 'rounds.questions'],
        orderBy: {
          rounds: { orderIndex: 'asc', questions: { orderIndex: 'asc' } },
        },
      },
    );
  }
}
