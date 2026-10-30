import {
  findQuestionOpenForAnswering,
  drawRemovedOptions,
  powerUpApplies,
  purchaseRefusal,
  teamCoins,
  type BuyPowerUpPayload,
  type PowerUpId,
  type PurchaseEffect,
  type SeededQuestion,
  type SessionSettings,
  type SessionState,
} from '@campus-pubquiz/types';
import {
  PurchaseService,
  toPurchaseViews,
  type PurchaseRecord,
} from '@/purchase/purchase.service';
import type { RandomSource } from '@/game/state/joker-changes';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import {
  BROADCAST_STATE_OUTCOME,
  connectedTeamSyncs,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import type { SessionChange } from '@/game/state/session-write';
import { requireSeat } from '@/game/state/session-updates.util';

/** The coins a team has left after `records`: the one place purchases subtract, through the shared balance. */
export function coinsAfter(
  settings: SessionSettings,
  records: readonly PurchaseRecord[],
  carriedCoin = 0,
  coinAwards = 0,
): number {
  return teamCoins(
    settings,
    carriedCoin,
    coinAwards,
    records.reduce((sum, { cost }) => sum + cost, 0),
  );
}

/**
 * What a power-up stores when bought on `question`: drawn once here and kept,
 * so every later read shows the same effect. A new power-up adds its case; the
 * type registry (`powerUpApplies`) has already kept it off questions it does
 * not work on.
 */
function effectOf(
  powerUp: PowerUpId,
  question: SeededQuestion,
  random: RandomSource,
): PurchaseEffect {
  switch (powerUp) {
    case 'fifty_fifty':
      return {
        kind: 'fifty_fifty',
        removedOptions: drawRemovedOptions(
          question.options ?? [],
          question.answer,
          random,
        ),
      };
    default:
      throw new Error(`No effect is defined for the ${powerUp} power-up`);
  }
}

/**
 * The purchase change module: a team buying a power-up. Follows the pattern
 * set out on SessionSettingsChanges. A refused purchase is thrown before
 * anything is stored.
 */
export class PurchaseChanges {
  constructor(
    private readonly purchaseService: PurchaseService,
    private readonly random: RandomSource,
  ) {}

  /**
   * A team buys `powerUp` for a question from `socketId`. Refused unless the
   * socket owns a team's seat and the shared rule (`purchaseRefusal`) allows
   * it: the question can be answered and the power-up works on it, the session
   * offers it, the limit is not used, it has not run on this question, and the
   * balance covers the cost. Stores the purchase with its drawn effect, tells
   * the team's own phones its purchases and coins, and refreshes the admin
   * room (the team's coins and the answer list showing what the answer used).
   */
  async buy(
    session: SessionState,
    { powerUp, questionId }: BuyPowerUpPayload,
    socketId: string,
  ): Promise<SessionChange<SessionOutcome>> {
    const teamId = requireSeat(
      session,
      socketId,
      'Join a team before buying a power-up',
    );
    const { settings, gameSessionId } = session.seededGame;
    // The caches the views read: carried coin and coin awards are decided elsewhere.
    const carriedCoin = session.carriedCoins[teamId];
    const coinAwards = session.coinAwards[teamId];
    const question = findQuestionOpenForAnswering(session, questionId);
    const records = await this.purchaseService.listForTeam(
      gameSessionId,
      teamId,
    );
    const setting = settings.powerUps[powerUp];
    const refusal = purchaseRefusal({
      setting,
      usesInSession: records.filter((record) => record.powerUp === powerUp)
        .length,
      isUsedOnQuestion: records.some(
        (record) =>
          record.powerUp === powerUp && record.questionId === questionId,
      ),
      balance: coinsAfter(settings, records, carriedCoin, coinAwards),
      isAnswerable: question !== undefined,
      applies: question !== undefined && powerUpApplies(powerUp, question),
    });
    if (refusal !== null || question === undefined) {
      throw new SessionRefusal(
        refusal ?? 'Answers are locked for this question',
      );
    }

    const bought: PurchaseRecord = {
      powerUp,
      questionId,
      roundId: null,
      cost: setting.cost,
      effect: effectOf(powerUp, question, this.random),
    };
    await this.purchaseService.add({ gameSessionId, teamId, ...bought });

    const all = [...records, bought];
    const payload = {
      purchases: toPurchaseViews(all),
      coins: coinsAfter(settings, all, carriedCoin, coinAwards),
    };
    return {
      session,
      outcome: {
        ...BROADCAST_STATE_OUTCOME,
        shouldBroadcastState: false,
        shouldBroadcastAdminState: true,
        answerListQuestionIds: [questionId],
        purchaseSyncs: connectedTeamSyncs(session, [teamId]).map((sync) => ({
          ...sync,
          payload,
        })),
      },
      touchedScores: true,
    };
  }

  /** The team's stored purchases, for a team joining or rejoining. */
  async loadForTeam(
    gameSessionId: number,
    teamId: number,
  ): Promise<PurchaseRecord[]> {
    return await this.purchaseService.listForTeam(gameSessionId, teamId);
  }
}
