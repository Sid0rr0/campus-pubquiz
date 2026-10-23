import { EntityRepository } from '@mikro-orm/postgresql';
import type { SessionTeamJoker } from '@/db/entities/session-team-joker.entity';

export class SessionTeamJokerRepository extends EntityRepository<SessionTeamJoker> {
  /** The joker a team holds this session; null when it has none. */
  async findForTeam(
    gameSessionId: number,
    teamId: number,
  ): Promise<SessionTeamJoker | null> {
    return this.findOne({ gameSession: gameSessionId, team: teamId });
  }
}
