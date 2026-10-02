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
import { Round } from '@/db/entities/round.entity';
import { Team } from '@/db/entities/team.entity';
import { RoundRatingRepository } from '@/db/repositories/round-rating.repository';

/** One team's 1–5 star rating of one round in one session; rating again overwrites (last write wins, like answers). */
@Entity({ tableName: 'round_ratings', repository: () => RoundRatingRepository })
@Unique({ properties: ['gameSession', 'round', 'team'] })
// listForTeam() filters by (gameSession, team), which isn't a usable prefix of
// the unique index above (team is its 3rd column).
@Index({ properties: ['gameSession', 'team'] })
export class RoundRating extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt';

  @ManyToOne(() => GameSession, { deleteRule: 'cascade' })
  gameSession!: GameSession;

  // A rating goes with its round when a live edit or re-import deletes it.
  @ManyToOne(() => Round, { deleteRule: 'cascade' })
  round!: Round;

  @ManyToOne(() => Team, { deleteRule: 'cascade' })
  team!: Team;

  @Property({ type: 'smallint' })
  stars!: number;
}
