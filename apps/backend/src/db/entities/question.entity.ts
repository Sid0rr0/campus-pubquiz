import {
  Entity,
  ManyToOne,
  OptionalProps,
  Property,
  Unique,
} from '@mikro-orm/core';
import type { QuestionType } from '@campus-pubquiz/types';
import { BaseEntity } from '@/db/entities/base.entity';
import { Round } from '@/db/entities/round.entity';
import { QuestionRepository } from '@/db/repositories/question.repository';

@Entity({ tableName: 'questions', repository: () => QuestionRepository })
@Unique({ properties: ['round', 'orderIndex'] })
export class Question extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'payload' | 'points';

  @ManyToOne(() => Round, { deleteRule: 'cascade' })
  round!: Round;

  @Property()
  orderIndex!: number;

  @Property({ type: 'text' })
  type!: QuestionType;

  @Property({ type: 'text' })
  prompt!: string;

  @Property({ type: 'text' })
  answer!: string;

  @Property({ type: 'text', nullable: true })
  notes?: string;

  @Property({ type: 'jsonb' })
  payload: Record<string, unknown> = {};

  @Property({ default: 1 })
  points: number = 1;
}
