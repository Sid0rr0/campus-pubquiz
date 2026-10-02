import {
  Entity,
  ManyToOne,
  OptionalProps,
  Property,
  Unique,
} from '@mikro-orm/core';
import { BaseEntity } from '@/db/entities/base.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { Team } from '@/db/entities/team.entity';
import { SessionFeedbackRepository } from '@/db/repositories/session-feedback.repository';

/** One team's "Anything else?" comment and topic suggestions for one session; sending again replaces the whole row. */
@Entity({
  tableName: 'session_feedback',
  repository: () => SessionFeedbackRepository,
})
@Unique({ properties: ['gameSession', 'team'] })
export class SessionFeedback extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt';

  @ManyToOne(() => GameSession, { deleteRule: 'cascade' })
  gameSession!: GameSession;

  @ManyToOne(() => Team, { deleteRule: 'cascade' })
  team!: Team;

  @Property({ type: 'text' })
  comment!: string;

  /** A JSON string array: parsed with Zod wherever it is read, never cast. */
  @Property({ type: 'jsonb' })
  topics!: unknown;
}
