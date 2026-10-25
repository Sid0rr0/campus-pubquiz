import {
  Entity,
  Enum,
  ManyToOne,
  OptionalProps,
  Property,
  Unique,
} from '@mikro-orm/core';
import {
  FELT_DIFFICULTY_VALUES,
  PACING_VALUES,
  type FeltDifficulty,
  type Pacing,
} from '@campus-pubquiz/types';
import { BaseEntity } from '@/db/entities/base.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { Team } from '@/db/entities/team.entity';
import { SessionFeedbackRepository } from '@/db/repositories/session-feedback.repository';

/**
 * One team's final-form feedback for one session: its "Anything else?"
 * comment and topic suggestions, and its pacing and felt-difficulty answers.
 * Sending the comment replaces the comment and topics only; answering a scale
 * replaces that scale only, so neither wipes the other. A row created by a
 * scale answer starts with an empty comment and no topics.
 */
@Entity({
  tableName: 'session_feedback',
  repository: () => SessionFeedbackRepository,
})
@Unique({ properties: ['gameSession', 'team'] })
export class SessionFeedback extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'pacing' | 'feltDifficulty';

  @ManyToOne(() => GameSession, { deleteRule: 'cascade' })
  gameSession!: GameSession;

  @ManyToOne(() => Team, { deleteRule: 'cascade' })
  team!: Team;

  @Property({ type: 'text' })
  comment!: string;

  /** A JSON string array: parsed with Zod wherever it is read, never cast. */
  @Property({ type: 'jsonb' })
  topics!: unknown;

  /** "How was the pace?"; null until the team answers it. */
  @Enum({ items: () => [...PACING_VALUES], nullable: true })
  pacing: Pacing | null = null;

  /** "How hard were the questions?"; null until the team answers it. */
  @Enum({ items: () => [...FELT_DIFFICULTY_VALUES], nullable: true })
  feltDifficulty: FeltDifficulty | null = null;
}
