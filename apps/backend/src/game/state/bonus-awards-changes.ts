import {
  type AwardBonusPayload,
  type BonusAwardAdminView,
  type CoinAwardedPayload,
  type SessionState,
  SOCKET_EVENTS,
  type TeamBonusAwardView,
  coinBalance,
  coinDebtCover,
  decideBonusAward,
  decideBonusEdit,
} from '@campus-pubquiz/types';
import { BonusAwardNotFoundError, BonusService } from '@/bonus/bonus.service';
import { BonusAwardNotFoundRefusal } from '@/game/state/errors/bonus-award-not-found-refusal.error';
import { InvalidBonusAwardRefusal } from '@/game/state/errors/invalid-bonus-award-refusal.error';
import type { SessionChange } from '@/game/state/session-write';
import {
  BROADCAST_STATE_OUTCOME,
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
   * An admin awards a bonus. The Bonus award policy decides whether it is
   * allowed (a refusal carries its message) and what is stored; the awarded
   * team's socket, if connected, gets the BONUS_AWARDED notice.
   */
  async award(
    session: SessionState,
    payload: AwardBonusPayload,
  ): Promise<SessionChange<SessionOutcome>> {
    const { teamId, category, points, reason, coins } = payload;
    const { gameSessionId } = session.seededGame;
    const decision = decideBonusAward(session, payload, {
      isOnRoster: await this.bonusService.isOnRoster(gameSessionId, teamId),
      existingCount:
        points === 0
          ? 0
          : await this.bonusService.awardCount(gameSessionId, teamId, category),
    });
    if ('refusal' in decision) {
      throw new InvalidBonusAwardRefusal(decision.refusal);
    }
    const { coinsGiven, coinTotal } = await this.bonusService.award(
      gameSessionId,
      teamId,
      decision.award,
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
          balance: coinBalance(next, teamId),
        },
      });
    }
    return bonusChange(next, teamId, notices);
  }

  /**
   * An admin edits an award's points and reason. The bonus store checks the
   * award belongs to this session (a missing award is a
   * BonusAwardNotFoundRefusal) and the Bonus award policy decides whether the
   * edit is allowed. Carries the updated admin view beside the change, and no
   * BONUS_AWARDED notice.
   */
  async edit(
    session: SessionState,
    awardId: number,
    points: number,
    reason: string | undefined,
  ): Promise<SessionChange<SessionOutcome> & { award: BonusAwardAdminView }> {
    const { gameSessionId } = session.seededGame;
    const stored = await this.refusing(() =>
      this.bonusService.findOwnedAward(gameSessionId, awardId),
    );
    const decision = decideBonusEdit(stored, points, reason);
    if ('refusal' in decision) {
      throw new InvalidBonusAwardRefusal(decision.refusal);
    }
    const { award, teamId } = await this.refusing(() =>
      this.bonusService.update(
        gameSessionId,
        awardId,
        decision.points,
        decision.reason,
      ),
    );
    return { ...bonusChange(session, teamId), award };
  }

  /** An admin deletes an award; a missing award is a BonusAwardNotFoundRefusal. Carries no BONUS_AWARDED notice; the awarded team's list is synced. */
  async remove(
    session: SessionState,
    awardId: number,
  ): Promise<SessionChange<SessionOutcome>> {
    const { gameSessionId } = session.seededGame;
    const removed = await this.refusing(() =>
      this.bonusService.remove(gameSessionId, awardId),
    );
    const { teamId } = removed;
    let { coinTotal } = removed;
    // The linked coin award went with it. Coins already spent must not turn into
    // a hidden debt (the balance shows 0, not less), so a coin award covers them.
    const shortfall = coinDebtCover(session, teamId, coinTotal);
    if (shortfall > 0) {
      ({ coinTotal } = await this.bonusService.coverSpentCoins(
        gameSessionId,
        teamId,
        shortfall,
        'Coins already spent when an award was deleted',
      ));
    }
    return bonusChange(withCoinTotal(session, teamId, coinTotal), teamId);
  }

  /** Runs a bonus store lookup, turning its not-found into a session refusal. */
  private async refusing<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof BonusAwardNotFoundError) {
        throw new BonusAwardNotFoundRefusal(error.message);
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
 * this module. The awarded team is listed for a fresh team view (its awards
 * and coins); `notices` (a fresh award only) go to that team's socket, if it
 * is connected.
 */
function bonusChange(
  session: SessionState,
  teamId: number,
  notices: TeamNotice[] = [],
): SessionChange<SessionOutcome> {
  return {
    session,
    outcome: {
      ...BROADCAST_STATE_OUTCOME,
      notices: notices.flatMap(({ teamId: noticeTeamId, ...notice }) => {
        const socketId = session.connectedTeamSockets[noticeTeamId];
        return socketId ? [{ socketId, ...notice }] : [];
      }),
      changedTeamIds: [teamId],
    },
  };
}
