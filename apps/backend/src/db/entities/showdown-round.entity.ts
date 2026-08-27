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
import { ShowdownRoundRepository } from '@/db/repositories/showdown-round.repository';

/** One tiebreaker-question round for teams tied at 1st place at `ended`. A tie left unresolved (isTie, no winnerTeam) is resolved by a fresh sudden-death round — see ShowdownService. */
@Entity({
  tableName: 'showdown_rounds',
  repository: () => ShowdownRoundRepository,
})
@Unique({ properties: ['gameSession', 'orderIndex'] })
export class ShowdownRound extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'isTie';

  @ManyToOne(() => GameSession, { deleteRule: 'cascade' })
  gameSession!: GameSession;

  /** 0, 1, 2… — supports sudden-death repeats within the same session. */
  @Property()
  orderIndex!: number;

  @Property({ type: 'text' })
  question!: string;

  @Property({ type: 'text' })
  answer!: string;

  @Property({ type: 'float' })
  points!: number;

  /** Set once resolved with a single closest guess; stays null on a tie. */
  @ManyToOne(() => Team, { nullable: true, deleteRule: 'set null' })
  winnerTeam?: Team;

  @Property({ default: false })
  isTie: boolean = false;

  @Property({ type: 'timestamptz', nullable: true })
  resolvedAt?: Date;
}
