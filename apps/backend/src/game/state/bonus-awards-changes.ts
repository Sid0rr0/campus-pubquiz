import {
  type AwardBonusPayload,
  type BonusAwardAdminView,
  type SessionState,
  SOCKET_EVENTS,
  type TeamBonusAwardView,
} from '@campus-pubquiz/types';
import {
  BonusAwardNotFoundError,
  BonusService,
  InvalidBonusAwardError,
} from '@/bonus/bonus.service';
import { BonusAwardNotFoundRefusal } from '@/game/state/errors/bonus-award-not-found-refusal.error';
import { InvalidBonusAwardRefusal } from '@/game/state/errors/invalid-bonus-award-refusal.error';
import type { SessionChange } from '@/game/state/session-write';
import {
  BROADCAST_STATE_OUTCOME,
  connectedTeamSyncs,
  type SessionOutcome,
} from '@/game/state/session-outcome';

/**
 * The bonus awards change module: builds the changes for the quiz master's
 * bonus award and for a bonus award edited or deleted over REST. It
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
    await this.refusing(() =>
      this.bonusService.award(
        session.seededGame.gameSessionId,
        teamId,
        category,
        points,
        reason,
        enabledBonusCategories,
        maxBonusAwardsPerCategory,
      ),
    );
    return bonusChange(session, {
      noticeFor: { teamId, notice: { category, points, reason } },
    });
  }

  /**
   * An admin edits an award's points and reason. The bonus service checks the
   * award belongs to this session; a refusal carries its message, and a missing
   * award is a BonusAwardNotFoundRefusal. Carries the updated admin view
   * beside the change, and no BONUS_AWARDED notice.
   */
  async edit(
    session: SessionState,
    awardId: number,
    points: number,
    reason: string | undefined,
  ): Promise<SessionChange<SessionOutcome> & { award: BonusAwardAdminView }> {
    const { award, teamId } = await this.refusing(() =>
      this.bonusService.update(
        session.seededGame.gameSessionId,
        awardId,
        points,
        reason,
      ),
    );
    return { ...bonusChange(session, { syncTeamId: teamId }), award };
  }

  /** An admin deletes an award; a missing award is a BonusAwardNotFoundRefusal. Carries no BONUS_AWARDED notice; the awarded team's list is synced. */
  async remove(
    session: SessionState,
    awardId: number,
  ): Promise<SessionChange<SessionOutcome>> {
    const { teamId } = await this.refusing(() =>
      this.bonusService.remove(session.seededGame.gameSessionId, awardId),
    );
    return bonusChange(session, { syncTeamId: teamId });
  }

  /** Runs a bonus service call, turning its refusals into session refusals. */
  private async refusing<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof BonusAwardNotFoundError) {
        throw new BonusAwardNotFoundRefusal(error.message);
      }
      if (error instanceof InvalidBonusAwardError) {
        throw new InvalidBonusAwardRefusal(error.message);
      }
      throw error;
    }
  }
}

/**
 * The change a bonus award makes, shared by all three events and private to
 * this module. `noticeFor` (a fresh award only) carries its BONUS_AWARDED
 * notice for that team's socket, if it is connected. `syncTeamId` (an edit or
 * deletion) lists the team for a bonus awards sync instead, if it is connected.
 */
function bonusChange(
  session: SessionState,
  {
    noticeFor,
    syncTeamId,
  }: {
    noticeFor?: { teamId: number; notice: TeamBonusAwardView };
    syncTeamId?: number;
  } = {},
): SessionChange<SessionOutcome> {
  const socketId = noticeFor
    ? session.connectedTeamSockets[noticeFor.teamId]
    : undefined;
  const notices =
    noticeFor && socketId
      ? [
          {
            socketId,
            event: SOCKET_EVENTS.BONUS_AWARDED,
            payload: noticeFor.notice,
          },
        ]
      : [];
  const bonusSyncs =
    syncTeamId === undefined ? [] : connectedTeamSyncs(session, [syncTeamId]);
  return {
    session,
    outcome: { ...BROADCAST_STATE_OUTCOME, notices, bonusSyncs },
  };
}
