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
    | 'author'
    | 'note'
    | 'showNoteOnScreen';

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

  /** What the quiz master says while this round's intro is on air — plain text, trimmed, at most ROUND_NOTE_MAX_LENGTH characters, validated at the request boundary; null when blank. Host-only. */
  @Property({ type: 'text', nullable: true })
  note?: string;

  /** Whether the round note also shows on the big screen's round intro and break round intro. Off by default; has no effect while the note is blank. */
  @Property({ default: false })
  showNoteOnScreen: boolean = false;

  @OneToMany(() => Question, (question) => question.round)
  questions = new Collection<Question>(this);
}
