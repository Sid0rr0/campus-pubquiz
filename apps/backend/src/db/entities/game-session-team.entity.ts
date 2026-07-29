import { Entity, ManyToOne, OptionalProps } from '@mikro-orm/core';
import { TimestampedEntity } from '@/db/entities/timestamped.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { Team } from '@/db/entities/team.entity';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';

@Entity({
  tableName: 'game_session_teams',
  repository: () => GameSessionTeamRepository,
})
export class GameSessionTeam extends TimestampedEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt';

  @ManyToOne(() => GameSession, { primary: true, deleteRule: 'cascade' })
  gameSession!: GameSession;

  @ManyToOne(() => Team, { primary: true, deleteRule: 'cascade' })
  team!: Team;
}
