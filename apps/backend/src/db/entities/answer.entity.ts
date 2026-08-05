import {
  Entity,
  Index,
  ManyToOne,
  OptionalProps,
  Property,
  Unique,
} from '@mikro-orm/core';
import { BaseEntity } from '@/db/entities/base.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { Question } from '@/db/entities/question.entity';
import { Team } from '@/db/entities/team.entity';
import { AnswerRepository } from '@/db/repositories/answer.repository';

@Entity({ tableName: 'answers', repository: () => AnswerRepository })
@Unique({ properties: ['gameSession', 'question', 'team'] })
// listForTeam() (answer.service.ts) filters by (gameSession, team), which
// isn't a usable prefix of the unique index above (team is its 3rd column).
@Index({ properties: ['gameSession', 'team'] })
export class Answer extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'pointsAwarded';

  @ManyToOne(() => GameSession, { deleteRule: 'cascade' })
  gameSession!: GameSession;

  @ManyToOne(() => Question, { deleteRule: 'cascade' })
  question!: Question;

  @ManyToOne(() => Team, { deleteRule: 'cascade' })
  team!: Team;

  @Property({ type: 'text' })
  value!: string;

  // Defaults to 0 (not graded yet, not "graded zero") — gradedAt below is
  // the authoritative "is this graded" signal, not this being non-zero.
  // 'float' not 'double': MikroORM v6.6's DoubleType.convertToJSValue does
  // `+value`, which is harmless here but 'float' avoids it on principle.
  @Property({ type: 'float', default: 0 })
  pointsAwarded: number = 0;

  @Property({ type: 'timestamptz', nullable: true })
  gradedAt?: Date;
}
