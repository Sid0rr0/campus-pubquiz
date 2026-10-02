import { EntityRepository } from '@mikro-orm/postgresql';
import type { RoundRating } from '@/db/entities/round-rating.entity';

export class RoundRatingRepository extends EntityRepository<RoundRating> {
  /** Every round rating a team has given this session, for its own team-facing view. */
  async listForTeam(
    gameSessionId: number,
    teamId: number,
  ): Promise<RoundRating[]> {
    return this.find(
      { gameSession: gameSessionId, team: teamId },
      { orderBy: { round: 'asc' } },
    );
  }
}
