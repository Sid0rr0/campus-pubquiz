import {
  askTheRoomSplit,
  findQuestionOpenForAnswering,
  isCurrentRoundKahoot,
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
  type SessionState,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import {
  PurchaseService,
  toPurchaseViews,
  type NewPurchase,
  type PurchaseRecord,
} from '@/purchase/purchase.service';
import { roundNowHolding, type RandomSource } from '@/game/state/joker-changes';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import {
  BROADCAST_STATE_OUTCOME,
  connectedTeamSyncs,
  type PurchaseSync,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import type { SessionChange } from '@/game/state/session-write';
import { requireSeat } from '@/game/state/session-updates.util';

/** The team's coins after `records`: the session's cached carried coin and coin awards (decided elsewhere) and the stored purchases. The one place purchases subtract, through the shared balance. */
export function balanceAfter(
  session: SessionState,
  teamId: number,
  records: readonly PurchaseRecord[],
): number {
  return teamCoins(
    session.seededGame.settings,
    session.carriedCoins[teamId],
    session.coinAwards[teamId],
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
      balance: balanceAfter(session, teamId, records),
      isAnswerable: question !== undefined,
      // A kahootMode tap locks the pick, so no question power-up can help there.
      applies:
        question !== undefined &&
        !isCurrentRoundKahoot(session) &&
        powerUpApplies(powerUp, question),
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
    // An answer already given was graded without the wider margin: grade it
    // again and send the team its answers, so it need not submit twice.
    const isWider = powerUp === 'wider_margin';
    if (isWider) {
      await this.answerService.regradeForWiderMargin(
        gameSessionId,
        question,
        teamId,
      );
    }
    return await this.store(session, teamId, records, bought, {
      answerListQuestionIds: [questionId],
      ...(isWider && { teamSyncs: connectedTeamSyncs(session, [teamId]) }),
    });
  }

  /** Stores `bought`, then tells the team's own phones its purchases and coins and refreshes the admin room. */
  private async store(
    session: SessionState,
    teamId: number,
    records: readonly PurchaseRecord[],
    bought: PurchaseRecord,
    outcome: Partial<SessionOutcome>,
  ): Promise<SessionChange<SessionOutcome>> {
    await this.purchaseService.add({
      gameSessionId: session.seededGame.gameSessionId,
      teamId,
      ...bought,
    });
    const all = [...records, bought];
    const payload = {
      purchases: toPurchaseViews(
        all,
        session.seededGame,
        session.progress.status,
      ),
      coins: balanceAfter(session, teamId, all),
    };
    return {
      session,
      outcome: {
        ...BROADCAST_STATE_OUTCOME,
        shouldBroadcastState: false,
        shouldBroadcastAdminState: true,
        ...outcome,
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
      balance: balanceAfter(session, teamId, records),
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
    return await this.store(session, teamId, records, bought, {});
  }

  /**
   * Keeps every extra joker on its round after a live edit reloaded the quiz
   * (`reloaded`; `started` is the session before it), as the quiz master's
   * joker does: a round is known by its questions, so the purchase follows the
   * round now holding them. The purchases are stored again from the session's
   * cache (oldest first), since the edit's deleted round rows have already
   * taken theirs. Unlike the joker it is not redrawn when its round
   * is gone (a team must hold a joker, but an extra one is optional): the
   * purchase is removed and its cost handed back, as the database already does
   * when the edit deletes the round row. A second extra joker that lands on a
   * round the team already doubles is refunded the same way. Runs before the
   * jokers follow, which read these rows. Every connected team is told its
   * purchases and coins, since a refund moves the balance.
   */
  async followRoundsAfterEdit(
    started: SessionState,
    reloaded: SessionState,
  ): Promise<{ session: SessionState; purchaseSyncs: PurchaseSync[] }> {
    const { gameSessionId, settings } = reloaded.seededGame;
    if (settings.powerUps.extra_joker.maxUses === 0) {
      return { session: reloaded, purchaseSyncs: [] };
    }
    // The rows come from the session's cache, not the database: a deleted round
    // row has taken its purchases with it (cascade), even for a round that
    // lives on in another row.
    const kept = new Set<string>();
    const rebuilt: NewPurchase[] = [];
    for (const bought of started.funFactData.powerUps) {
      if (bought.powerUp !== 'extra_joker' || bought.roundId === null) continue;
      const next = roundNowHolding(started, reloaded, bought.roundId);
      const key = `${bought.teamId}:${next}`;
      const isKahoot =
        reloaded.seededGame.rounds.find((round) => round.id === next)
          ?.kahootMode ?? false;
      // A round the edit made a kahootMode round is no longer doubled: refunded.
      if (next === null || isKahoot || kept.has(key)) continue;
      kept.add(key);
      rebuilt.push({
        gameSessionId,
        teamId: bought.teamId,
        powerUp: 'extra_joker',
        questionId: null,
        roundId: next,
        cost: bought.cost,
        effect: { kind: 'extra_joker' },
      });
    }
    // Added before the old rows go, so a failure in between never loses one.
    const old = await this.purchaseService.extraJokerRows(gameSessionId);
    for (const purchase of rebuilt) await this.purchaseService.add(purchase);
    await this.purchaseService.remove(old.map((row) => row.id));

    const purchaseSyncs: PurchaseSync[] = [];
    for (const sync of connectedTeamSyncs(
      reloaded,
      Object.keys(reloaded.connectedTeamSockets).map(Number),
    )) {
      const records = await this.purchaseService.listForTeam(
        gameSessionId,
        sync.teamId,
      );
      purchaseSyncs.push({
        ...sync,
        payload: {
          purchases: toPurchaseViews(
            records,
            reloaded.seededGame,
            reloaded.progress.status,
          ),
          coins: balanceAfter(reloaded, sync.teamId, records),
        },
      });
    }
    return { session: reloaded, purchaseSyncs };
  }
}
