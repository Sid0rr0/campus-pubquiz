import {
  type AwardBonusPayload,
  type SessionState,
  SOCKET_EVENTS,
  type TeamBonusAwardView,
} from '@campus-pubquiz/types';
import { BonusService, InvalidBonusAwardError } from '@/bonus/bonus.service';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import type { SessionChange } from '@/game/state/session-write';
import {
  BROADCAST_STATE_OUTCOME,
  type SessionOutcome,
} from '@/game/state/session-outcome';

/**
 * The bonus awards change module: builds the changes for the quiz master's
 * bonus award and for a bonus award added, edited or deleted over REST. It
 * follows the pattern of the session settings change module: a plain class
 * that never references the Session write module or the game state class.
 */
export class BonusAwardsChanges {
  constructor(private readonly bonusService: BonusService) {}

  /**
   * An admin awards a bonus. The session's own enabled categories and
   * per-category limit decide whether it is allowed (a refusal carries the
   * bonus service's message); the awarded team's socket, if connected, gets
   * the BONUS_AWARDED notice.
   */
  async award(
    session: SessionState,
    { teamId, category, points, reason }: AwardBonusPayload,
  ): Promise<SessionChange<SessionOutcome>> {
    const { enabledBonusCategories, maxBonusAwardsPerCategory } =
      session.seededGame.settings;
    try {
      await this.bonusService.award(
        session.seededGame.gameSessionId,
        teamId,
        category,
        points,
        reason,
        enabledBonusCategories,
        maxBonusAwardsPerCategory,
      );
    } catch (error) {
      if (error instanceof InvalidBonusAwardError) {
        throw new SessionRefusal(error.message);
      }
      throw error;
    }
    return bonusChange(session, {
      teamId,
      notice: { category, points, reason },
    });
  }

  /**
   * A bonus award was added, edited or deleted: refreshes the leaderboard the
   * same way grading does. Carries no BONUS_AWARDED notice.
   */
  changed(session: SessionState): Promise<SessionChange<SessionOutcome>> {
    return Promise.resolve(bonusChange(session));
  }
}

/**
 * The change a bonus award makes, shared by both events and private to this
 * module. `awarded` (a fresh award only) carries its BONUS_AWARDED notice for
 * that team's socket, if it is connected.
 */
function bonusChange(
  session: SessionState,
  awarded?: { teamId: number; notice: TeamBonusAwardView },
): SessionChange<SessionOutcome> {
  const socketId = awarded
    ? session.connectedTeamSockets[awarded.teamId]
    : undefined;
  const notices =
    awarded && socketId
      ? [
          {
            socketId,
            event: SOCKET_EVENTS.BONUS_AWARDED,
            payload: awarded.notice,
          },
        ]
      : [];
  return {
    session,
    outcome: { ...BROADCAST_STATE_OUTCOME, notices },
  };
}
