import {
  Entity,
  ManyToOne,
  OptionalProps,
  Property,
  Unique,
} from '@mikro-orm/core';
import type { JokerSource } from '@campus-pubquiz/types';
import { BaseEntity } from '@/db/entities/base.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { Round } from '@/db/entities/round.entity';
import { Team } from '@/db/entities/team.entity';
import { SessionTeamJokerRepository } from '@/db/repositories/session-team-joker.repository';

/**
 * The round one team doubles in one session, and how it came to hold it;
 * choosing again replaces the row. Kept apart from the roster row, which a
 * kick deletes: the joker must survive a kick and a rejoin. It references the
 * round, so it follows the round through reorders.
 */
@Entity({
  tableName: 'session_team_jokers',
  repository: () => SessionTeamJokerRepository,
})
@Unique({ properties: ['gameSession', 'team'] })
export class SessionTeamJoker extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt';

  @ManyToOne(() => GameSession, { deleteRule: 'cascade' })
  gameSession!: GameSession;

  @ManyToOne(() => Team, { deleteRule: 'cascade' })
  team!: Team;

  @ManyToOne(() => Round, { deleteRule: 'cascade' })
  round!: Round;

  @Property({ type: 'text' })
  source!: JokerSource;
}
