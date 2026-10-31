import {
  Entity,
  Index,
  ManyToOne,
  OptionalProps,
  Property,
} from '@mikro-orm/core';
import { BaseEntity } from '@/db/entities/base.entity';
import { BonusAward } from '@/db/entities/bonus-award.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { Team } from '@/db/entities/team.entity';
import { CoinAwardRepository } from '@/db/repositories/coin-award.repository';

/** A coin award in the ledger: coins given to (or, negative, taken from) a team in a session. Never points. */
@Entity({ tableName: 'coin_awards', repository: () => CoinAwardRepository })
@Index({ properties: ['gameSession', 'team'] })
export class CoinAward extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt';

  @ManyToOne(() => GameSession, { deleteRule: 'cascade' })
  gameSession!: GameSession;

  @ManyToOne(() => Team, { deleteRule: 'cascade' })
  team!: Team;

  @Property({ type: 'integer' })
  coins!: number;

  @Property({ type: 'text', nullable: true })
  reason?: string;

  // The shot or selfie bonus award these coins came with; the database deletes
  // the coin award when that bonus award is deleted. Null for a manual award.
  @ManyToOne(() => BonusAward, { nullable: true, deleteRule: 'cascade' })
  bonusAward?: BonusAward;
}
