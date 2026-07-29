import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  OptionalProps,
  Property,
  Unique,
} from '@mikro-orm/core';
import { BaseEntity } from '@/db/entities/base.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Question } from '@/db/entities/question.entity';
import { RoundRepository } from '@/db/repositories/round.repository';

@Entity({ tableName: 'rounds', repository: () => RoundRepository })
@Unique({ properties: ['quiz', 'orderIndex'] })
export class Round extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'breakAfter';

  @ManyToOne(() => Quiz, { deleteRule: 'cascade' })
  quiz!: Quiz;

  @Property({ type: 'text' })
  title!: string;

  @Property()
  orderIndex!: number;

  @Property({ default: false })
  breakAfter: boolean = false;

  @OneToMany(() => Question, (question) => question.round)
  questions = new Collection<Question>(this);
}
