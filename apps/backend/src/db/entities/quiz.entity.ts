import {
  Collection,
  Entity,
  OneToMany,
  OptionalProps,
  Property,
} from '@mikro-orm/core';
import type { QuizMode } from '@campus-pubquiz/types';
import { BaseEntity } from '@/db/entities/base.entity';
import { Round } from '@/db/entities/round.entity';
import { QuizRepository } from '@/db/repositories/quiz.repository';

@Entity({ tableName: 'quizzes', repository: () => QuizRepository })
export class Quiz extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'mode';

  @Property({ type: 'text' })
  title!: string;

  /** Chosen at creation, never changed: a session's rounds all take their quickfire flag from it. */
  @Property({ type: 'text', default: 'pub' })
  mode: QuizMode = 'pub';

  @OneToMany(() => Round, (round) => round.quiz)
  rounds = new Collection<Round>(this);
}
