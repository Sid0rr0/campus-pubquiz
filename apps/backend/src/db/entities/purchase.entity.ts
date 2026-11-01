import {
  Entity,
  Index,
  ManyToOne,
  OptionalProps,
  Property,
} from '@mikro-orm/core';
import type { PowerUpId } from '@campus-pubquiz/types';
import { BaseEntity } from '@/db/entities/base.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { Question } from '@/db/entities/question.entity';
import { Round } from '@/db/entities/round.entity';
import { Team } from '@/db/entities/team.entity';
import { PurchaseRepository } from '@/db/repositories/purchase.repository';

/**
 * One power-up a team bought in one session: what it paid and the effect it
 * stored (JSON, parsed against `purchaseEffectSchema` on read), so a reconnect
 * or restart shows the same effect. A question power-up names its `question`,
 * a round power-up its `round`. The coin balance is worked out from these rows
 * (the sum of `cost`), never stored.
 */
@Entity({ tableName: 'purchases', repository: () => PurchaseRepository })
@Index({ properties: ['gameSession', 'team'] })
export class Purchase extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'question' | 'round';

  @ManyToOne(() => GameSession, { deleteRule: 'cascade' })
  gameSession!: GameSession;

  @ManyToOne(() => Team, { deleteRule: 'cascade' })
  team!: Team;

  @Property({ type: 'text' })
  powerUp!: PowerUpId;

  @ManyToOne(() => Question, { nullable: true, deleteRule: 'cascade' })
  question?: Question;

  @ManyToOne(() => Round, { nullable: true, deleteRule: 'cascade' })
  round?: Round;

  /** The cost the team paid, kept so a later change to the session's table never rewrites the ledger. */
  @Property({ type: 'integer' })
  cost!: number;

  @Property({ type: 'jsonb' })
  effect!: Record<string, unknown>;
}
