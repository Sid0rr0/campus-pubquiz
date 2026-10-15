import { EntityRepository } from '@mikro-orm/postgresql';
import type { SessionPlayerCount } from '@/db/entities/session-player-count.entity';

export class SessionPlayerCountRepository extends EntityRepository<SessionPlayerCount> {
  /** The count a team reported this session; null when it reported none. */
  async findForTeam(
    gameSessionId: number,
    teamId: number,
  ): Promise<SessionPlayerCount | null> {
    return this.findOne({ gameSession: gameSessionId, team: teamId });
  }
}
