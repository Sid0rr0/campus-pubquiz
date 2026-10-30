import {
  type AwardBonusPayload,
  type BonusAwardAdminView,
  type CoinAwardedPayload,
  type SessionState,
  SOCKET_EVENTS,
  type TeamBonusAwardView,
  coinBalanceOf,
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
    { teamId, category, points, reason, coins }: AwardBonusPayload,
  ): Promise<SessionChange<SessionOutcome>> {
    const { settings } = session.seededGame;
    const { coinsGiven, coinTotal } = await this.refusing(() =>
      this.bonusService.award(
        session.seededGame.gameSessionId,
        teamId,
        category,
        points,
        reason,
        settings.enabledBonusCategories,
        settings.maxBonusAwardsPerCategory,
        { powerUpsEnabled: settings.powerUpsEnabled, manual: coins },
      ),
    );
    const notices: TeamNotice[] = [];
    // Coins alone give no bonus award, so there is no bonus toast.
    if (points !== 0) {
      notices.push({
        teamId,
        event: SOCKET_EVENTS.BONUS_AWARDED,
        payload: { category, points, reason },
      });
    }
    const next = withCoinTotal(session, teamId, coinTotal);
    if (coinsGiven !== 0) {
      notices.push({
        teamId,
        event: SOCKET_EVENTS.COIN_AWARDED,
        payload: {
          coins: coinsGiven,
          // Only the quiz master's own coins carry the reason typed in the form.
          reason: coins ? reason?.trim() || undefined : undefined,
          balance: coinBalanceOf(next, teamId),
        },
      });
    }
    return bonusChange(next, { notices });
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
    const { teamId, coinTotal } = await this.refusing(() =>
      this.bonusService.remove(session.seededGame.gameSessionId, awardId),
    );
    const next = withCoinTotal(session, teamId, coinTotal);
    return bonusChange(next, {
      syncTeamId: teamId,
      coinSync: coinBalanceOf(next, teamId),
    });
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

/** A notice for one team's phone: the bonus toast or the coin toast of a fresh award. */
type TeamNotice = { teamId: number } & (
  | { event: typeof SOCKET_EVENTS.BONUS_AWARDED; payload: TeamBonusAwardView }
  | { event: typeof SOCKET_EVENTS.COIN_AWARDED; payload: CoinAwardedPayload }
);

/** The session with the team's coin award total replaced (what the views read). */
function withCoinTotal(
  session: SessionState,
  teamId: number,
  coinTotal: number,
): SessionState {
  return {
    ...session,
    coinAwards: { ...session.coinAwards, [teamId]: coinTotal },
  };
}

/**
 * The change a bonus award makes, shared by all three events and private to
 * this module. `notices` (a fresh award only) go to that team's socket, if it
 * is connected. `syncTeamId` (an edit or deletion) lists the team for a bonus
 * awards sync instead, if it is connected; `coinSync` (a deletion) also tells
 * it its new coin balance.
 */
function bonusChange(
  session: SessionState,
  {
    notices = [],
    syncTeamId,
    coinSync,
  }: { notices?: TeamNotice[]; syncTeamId?: number; coinSync?: number } = {},
): SessionChange<SessionOutcome> {
  const bonusSyncs =
    syncTeamId === undefined ? [] : connectedTeamSyncs(session, [syncTeamId]);
  return {
    session,
    outcome: {
      ...BROADCAST_STATE_OUTCOME,
      notices: notices.flatMap(({ teamId, ...notice }) => {
        const socketId = session.connectedTeamSockets[teamId];
        return socketId ? [{ socketId, ...notice }] : [];
      }),
      bonusSyncs,
      coinSyncs:
        coinSync === undefined
          ? []
          : bonusSyncs.map((sync) => ({ ...sync, balance: coinSync })),
    },
    touchedScores: true,
  };
}
