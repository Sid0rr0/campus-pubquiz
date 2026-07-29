import {
  Collection,
  Entity,
  OneToMany,
  OptionalProps,
  Property,
} from '@mikro-orm/core';
import { BaseEntity } from '@/db/entities/base.entity';
import { Round } from '@/db/entities/round.entity';
import { QuizRepository } from '@/db/repositories/quiz.repository';

@Entity({ tableName: 'quizzes', repository: () => QuizRepository })
export class Quiz extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt';

  @Property({ type: 'text' })
  title!: string;

  @OneToMany(() => Round, (round) => round.quiz)
  rounds = new Collection<Round>(this);
}
