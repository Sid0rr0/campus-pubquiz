import {
  type AwardBonusPayload,
  type BonusAwardAdminView,
  type CoinAwardedPayload,
  type SessionState,
  SOCKET_EVENTS,
  type TeamBonusAwardView,
  coinBalanceOf,
  purchaseCostsOf,
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
  coinSyncsFor,
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
    // A take is refused whole when it is more than the team has, so a balance never hides a debt.
    if (coins !== undefined && coins < 0) {
      const balance = coinBalanceOf(session, teamId);
      if (-coins > balance) {
        throw new InvalidBonusAwardRefusal(
          `That team has only ${balance} ${balance === 1 ? 'coin' : 'coins'} to take`,
        );
      }
    }
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
    const { gameSessionId, settings } = session.seededGame;
    const removed = await this.refusing(() =>
      this.bonusService.remove(gameSessionId, awardId),
    );
    const { teamId } = removed;
    let { coinTotal } = removed;
    // The linked coin award went with it. Coins already spent must not turn into
    // a hidden debt (the balance shows 0, not less), so a coin award covers them.
    const shortfall = coinShortfall(session, teamId, coinTotal);
    if (shortfall > 0) {
      ({ coinTotal } = await this.refusing(() =>
        this.bonusService.award(
          gameSessionId,
          teamId,
          'custom',
          0,
          'Coins already spent when an award was deleted',
          settings.enabledBonusCategories,
          settings.maxBonusAwardsPerCategory,
          { powerUpsEnabled: settings.powerUpsEnabled, manual: shortfall },
        ),
      ));
    }
    return bonusChange(withCoinTotal(session, teamId, coinTotal), {
      syncTeamId: teamId,
      syncsCoins: true,
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

/** The coins the team has spent beyond what it has coming in (starting, carried, awards): what a balance floored at 0 would hide. */
function coinShortfall(
  session: SessionState,
  teamId: number,
  coinAwardTotal: number,
): number {
  const { settings } = session.seededGame;
  const income =
    (settings.powerUpsEnabled ? settings.startingCoins : 0) +
    (session.carriedCoins[teamId] ?? 0) +
    coinAwardTotal;
  return Math.max(
    0,
    purchaseCostsOf(session.funFactData.powerUps, teamId) - income,
  );
}

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
 * awards sync instead, if it is connected; `syncsCoins` (a deletion) also tells
 * it its new coins.
 */
function bonusChange(
  session: SessionState,
  {
    notices = [],
    syncTeamId,
    syncsCoins = false,
  }: { notices?: TeamNotice[]; syncTeamId?: number; syncsCoins?: boolean } = {},
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
        syncsCoins && syncTeamId !== undefined
          ? coinSyncsFor(session, [syncTeamId])
          : [],
    },
    touchedScores: true,
  };
}
