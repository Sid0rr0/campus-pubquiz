import {
  Entity,
  ManyToOne,
  OptionalProps,
  Property,
  Unique,
} from '@mikro-orm/core';
import { BaseEntity } from '@/db/entities/base.entity';
import { ShowdownRound } from '@/db/entities/showdown-round.entity';
import { Team } from '@/db/entities/team.entity';
import { ShowdownRoundTeamRepository } from '@/db/repositories/showdown-round-team.repository';

/** One participating team's seat + guess within a ShowdownRound — a join table (not fixed teamA/teamB columns) so the same schema handles a 2-way, 3-way, or wider tie. */
@Entity({
  tableName: 'showdown_round_teams',
  repository: () => ShowdownRoundTeamRepository,
})
@Unique({ properties: ['showdownRound', 'team'] })
export class ShowdownRoundTeam extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt';

  @ManyToOne(() => ShowdownRound, { deleteRule: 'cascade' })
  showdownRound!: ShowdownRound;

  @ManyToOne(() => Team, { deleteRule: 'cascade' })
  team!: Team;

  /** Reveal order, 0..N-1 — fixed at round creation from leaderboard order. */
  @Property()
  seatIndex!: number;

  @Property({ type: 'text', nullable: true })
  guess?: string;
}
