import { EntityRepository } from '@mikro-orm/postgresql';
import type { SessionFeedback } from '@/db/entities/session-feedback.entity';

export class SessionFeedbackRepository extends EntityRepository<SessionFeedback> {
  /** The feedback a team sent this session, for its own team-facing view; null when it sent none. */
  async findForTeam(
    gameSessionId: number,
    teamId: number,
  ): Promise<SessionFeedback | null> {
    return this.findOne({ gameSession: gameSessionId, team: teamId });
  }
}
