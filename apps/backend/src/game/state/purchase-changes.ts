import {
  askTheRoomSplit,
  findQuestionOpenForAnswering,
  drawRemovedOptions,
  drawPin,
  extraJokerRefusal,
  extraJokerRoundId,
  powerUpApplies,
  purchaseRefusal,
  teamCoins,
  textHint,
  type BuyPowerUpPayload,
  type PowerUpId,
  type PurchaseEffect,
  type SeededQuestion,
  type SessionSettings,
  type SessionState,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
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
  otherAnswers: readonly string[],
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
    case 'first_letter':
    case 'letter_count':
      return {
        kind: powerUp,
        hint: textHint(powerUp, question.answer),
      };
    case 'wider_margin':
      return { kind: 'wider_margin' };
    case 'ask_the_room': {
      const split = askTheRoomSplit(question.options ?? [], otherAnswers);
      if (split === null) throw new SessionRefusal('Waiting for more answers');
      return { kind: 'ask_the_room', split };
    }
    case 'pin_one':
      return drawPin(question.answer, random);
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
    private readonly answerService: AnswerService,
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
    request: BuyPowerUpPayload,
    socketId: string,
  ): Promise<SessionChange<SessionOutcome>> {
    if (request.roundId !== undefined) {
      return await this.buyExtraJoker(session, request.roundId, socketId);
    }
    const { powerUp, questionId } = request;
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
      effect: effectOf(
        powerUp,
        question,
        this.random,
        powerUp === 'ask_the_room'
          ? (
              await this.answerService.listForQuestion(
                gameSessionId,
                questionId,
              )
            )
              .filter((answer) => answer.teamId !== teamId)
              .map((answer) => answer.value)
          : [],
      ),
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

  /**
   * A team buys an extra joker for `roundId`: refused unless it is the next
   * round (`extraJokerRoundId`) and the rest of `extraJokerRefusal` allows it.
   * Scoring reads the stored purchase; nothing is cached on the session.
   */
  private async buyExtraJoker(
    session: SessionState,
    roundId: number,
    socketId: string,
  ): Promise<SessionChange<SessionOutcome>> {
    const teamId = requireSeat(
      session,
      socketId,
      'Join a team before buying a power-up',
    );
    const { settings, gameSessionId } = session.seededGame;
    const carriedCoin = session.carriedCoins[teamId];
    const coinAwards = session.coinAwards[teamId];
    const records = await this.purchaseService.listForTeam(
      gameSessionId,
      teamId,
    );
    const setting = settings.powerUps.extra_joker;
    const jokerRoundId = session.jokers[teamId]?.roundId;
    const refusal = extraJokerRefusal({
      setting,
      usesInSession: records.filter(
        (record) => record.powerUp === 'extra_joker',
      ).length,
      balance: coinsAfter(settings, records, carriedCoin, coinAwards),
      roundId,
      offeredRoundId: extraJokerRoundId(session),
      doubledRoundIds: [
        ...(jokerRoundId === undefined ? [] : [jokerRoundId]),
        ...records.flatMap((record) =>
          record.powerUp === 'extra_joker' && record.roundId !== null
            ? [record.roundId]
            : [],
        ),
      ],
    });
    if (refusal !== null) throw new SessionRefusal(refusal);

    const bought: PurchaseRecord = {
      powerUp: 'extra_joker',
      questionId: null,
      roundId,
      cost: setting.cost,
      effect: { kind: 'extra_joker' },
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
