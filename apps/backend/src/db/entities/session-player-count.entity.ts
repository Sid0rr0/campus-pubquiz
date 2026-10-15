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
import { SessionPlayerCountRepository } from '@/db/repositories/session-player-count.repository';

/**
 * How many players one team brought to one session; reporting again replaces
 * the number. Kept apart from the roster row, which a kick deletes: the count
 * must survive a kick and a rejoin.
 */
@Entity({
  tableName: 'session_player_counts',
  repository: () => SessionPlayerCountRepository,
})
@Unique({ properties: ['gameSession', 'team'] })
export class SessionPlayerCount extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt';

  @ManyToOne(() => GameSession, { deleteRule: 'cascade' })
  gameSession!: GameSession;

  @ManyToOne(() => Team, { deleteRule: 'cascade' })
  team!: Team;

  @Property({ type: 'integer' })
  playerCount!: number;
}
