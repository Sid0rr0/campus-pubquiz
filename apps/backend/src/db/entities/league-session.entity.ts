import { Entity, ManyToOne, OptionalProps, Unique } from '@mikro-orm/core';
import { BaseEntity } from '@/db/entities/base.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { League } from '@/db/entities/league.entity';
import { LeagueSessionRepository } from '@/db/repositories/league-session.repository';

/** Membership of one session in one league. Deleting either side removes only this row. */
@Entity({
  tableName: 'league_sessions',
  repository: () => LeagueSessionRepository,
})
@Unique({ properties: ['league', 'gameSession'] })
export class LeagueSession extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt';

  @ManyToOne(() => League, { deleteRule: 'cascade' })
  league!: League;

  @ManyToOne(() => GameSession, { deleteRule: 'cascade' })
  gameSession!: GameSession;
}
