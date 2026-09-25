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
  [OptionalProps]?:
    | 'createdAt'
    | 'updatedAt'
    | 'breakAfter'
    | 'kahootMode'
    | 'category'
    | 'author';

  @ManyToOne(() => Quiz, { deleteRule: 'cascade' })
  quiz!: Quiz;

  @Property({ type: 'text' })
  title!: string;

  @Property()
  orderIndex!: number;

  @Property({ default: false })
  breakAfter: boolean = false;

  @Property({ default: false })
  kahootMode: boolean = false;

  /** Round topic/theme — one of ROUND_CATEGORIES, validated at the request boundary (quiz-draft.schema.ts / question-row.schema.ts), not by the DB. Optional, manual/CSV-set metadata shown on the big screen. */
  @Property({ type: 'text', nullable: true })
  category?: string;

  /** Who wrote this round's questions — optional, manual/CSV-set metadata shown on the big screen. */
  @Property({ type: 'text', nullable: true })
  author?: string;

  @OneToMany(() => Question, (question) => question.round)
  questions = new Collection<Question>(this);
}
