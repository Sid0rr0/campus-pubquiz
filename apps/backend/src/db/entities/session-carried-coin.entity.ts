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
import { SessionCarriedCoinRepository } from '@/db/repositories/session-carried-coin.repository';

/**
 * The carried coins one team brings into one session: 2 when it rated every
 * round of its last ended session in a shared league, else 0. Decided once
 * (at the start, or at the team's late join) and kept, so a later league
 * change doesn't take it back. Kept apart from the roster row, which a kick
 * deletes.
 */
@Entity({
  tableName: 'session_carried_coins',
  repository: () => SessionCarriedCoinRepository,
})
@Unique({ properties: ['gameSession', 'team'] })
export class SessionCarriedCoin extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt';

  @ManyToOne(() => GameSession, { deleteRule: 'cascade' })
  gameSession!: GameSession;

  @ManyToOne(() => Team, { deleteRule: 'cascade' })
  team!: Team;

  @Property({ type: 'integer' })
  coins!: number;
}
