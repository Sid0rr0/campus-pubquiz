import { doubledRoundIds } from './doubled-rounds';
import {
  POWER_UP_IDS,
  powerUpApplies,
  type PowerUpId,
  type PowerUpSettings,
} from './power-ups';
import type { QuestionType } from './question-types';

/** The question a power-up would be bought for: one that can be answered now, and whether its round is a quickfire round. */
export interface OfferedQuestion {
  id: number;
  type: QuestionType;
  options?: readonly string[];
  isQuickfire: boolean;
}

/** What the offer needs, as plain data: the same on the server and the phone. */
export interface QuestionOfferInput {
  settings: PowerUpSettings;
  /** The team's own purchases. */
  purchases: readonly { powerUp: PowerUpId; questionId: number | null }[];
  balance: number;
  /** The question being answered right now, or null when nothing can be answered. */
  question: OfferedQuestion | null;
  /** Whether Ask the room is ready on `question`; only read for Ask the room. */
  isRoomReady: boolean;
}

export type OfferOutcome =
  | { status: 'available' }
  /** Only the coins or Ask the room's readiness stand in the way. */
  | { status: 'held_back'; reason: string }
  | { status: 'unavailable'; reason: string };

export interface PowerUpOfferEntry {
  powerUp: PowerUpId;
  cost: number;
  maxUses: number;
  /** How many times this team bought this power-up. */
  used: number;
  outcome: OfferOutcome;
}

const NOT_ENOUGH_COINS = 'Not enough coins';
const WAITING = 'Waiting for more answers';
const WRONG_ROUND = 'Only the next round can be doubled, before its intro';
const HELD_BACK_REASONS = [NOT_ENOUGH_COINS, WAITING];

/** Why `powerUp` can't be bought on `question` now (worded for the team), or null. The order is the server's. */
function refusalOf(
  powerUp: PowerUpId,
  question: OfferedQuestion | null,
  input: QuestionOfferInput,
): string | null {
  if (question === null) return 'Answers are locked for this question';
  // A quickfire tap locks the pick, so no question power-up can help there.
  if (question.isQuickfire || !powerUpApplies(powerUp, question)) {
    return 'That power-up does not work on this question';
  }
  const { cost, maxUses } = input.settings[powerUp];
  if (maxUses === 0) return 'That power-up is not offered';
  const bought = input.purchases.filter((p) => p.powerUp === powerUp);
  if (bought.length >= maxUses) {
    return 'You have reached the limit for that power-up';
  }
  if (bought.some((p) => p.questionId === question.id)) {
    return 'You already used that power-up on this question';
  }
  if (input.balance < cost) return NOT_ENOUGH_COINS;
  if (powerUp === 'ask_the_room' && !input.isRoomReady) return WAITING;
  return null;
}

/** Why buying `powerUp` for `questionId` is refused, or null when it goes through. A question other than the offered one counts as locked. */
export function questionPurchaseRefusal(
  input: QuestionOfferInput & { powerUp: PowerUpId; questionId: number },
): string | null {
  const { question, powerUp, questionId } = input;
  return refusalOf(
    powerUp,
    question?.id === questionId ? question : null,
    input,
  );
}

function outcomeOf(reason: string | null): OfferOutcome {
  if (reason === null) return { status: 'available' };
  return {
    status: HELD_BACK_REASONS.includes(reason) ? 'held_back' : 'unavailable',
    reason,
  };
}

/** One entry per question power-up the session offers, in power-up order, with what the team can do with it now. The extra joker is not here. */
export function questionPowerUpOffer(
  input: QuestionOfferInput,
): PowerUpOfferEntry[] {
  return POWER_UP_IDS.filter(
    (powerUp) =>
      powerUp !== 'extra_joker' && input.settings[powerUp].maxUses > 0,
  ).map((powerUp) => {
    const { cost, maxUses } = input.settings[powerUp];
    return {
      powerUp,
      cost,
      maxUses,
      used: input.purchases.filter((p) => p.powerUp === powerUp).length,
      outcome: outcomeOf(refusalOf(powerUp, input.question, input)),
    };
  });
}

/** What the extra joker's rule needs, as plain data. */
export interface ExtraJokerRuleInput {
  settings: PowerUpSettings;
  /** The team's own purchases. */
  purchases: readonly { powerUp: PowerUpId; roundId: number | null }[];
  balance: number;
  /** The team's joker round, which an extra joker cannot double again. */
  jokerRoundId: number | undefined | null;
}

/** The next round, as the phone is told of it: its title is "" when the round overview did not show it. */
export interface OfferedRound {
  roundId: number;
  roundNumber: number;
  title: string;
}

/** Why an extra joker for `roundId` is refused (worded for the team), or null when it goes through. The order is the server's. */
function extraJokerRefusalOf(
  input: ExtraJokerRuleInput,
  roundId: number,
  offeredRoundId: number | null,
): string | null {
  const { cost, maxUses } = input.settings.extra_joker;
  if (maxUses === 0) return 'That power-up is not offered';
  if (roundId !== offeredRoundId) return WRONG_ROUND;
  const doubled = doubledRoundIds(
    input.jokerRoundId ?? undefined,
    input.purchases,
  );
  if (doubled.includes(roundId)) return 'That round is already doubled';
  const used = input.purchases.filter((p) => p.powerUp === 'extra_joker');
  if (used.length >= maxUses) {
    return 'You have reached the limit for that power-up';
  }
  return input.balance < cost ? NOT_ENOUGH_COINS : null;
}

/** Why buying an extra joker for `roundId` is refused, or null when it goes through. `offeredRoundId` is what `extraJokerRoundId` says is on offer. */
export function extraJokerPurchaseRefusal(
  input: ExtraJokerRuleInput & {
    roundId: number;
    offeredRoundId: number | null;
  },
): string | null {
  return extraJokerRefusalOf(input, input.roundId, input.offeredRoundId);
}

export interface ExtraJokerOfferEntry extends PowerUpOfferEntry {
  /** The offered round as the card names it (its title, or "Round N"); null when no round is offered. */
  roundName: string | null;
}

/** The extra joker's entry with what the team can do with it now, or null when the session does not offer it. */
export function extraJokerOfferEntry(
  input: ExtraJokerRuleInput & { offer: OfferedRound | null },
): ExtraJokerOfferEntry | null {
  const { cost, maxUses } = input.settings.extra_joker;
  if (maxUses === 0) return null;
  const { offer } = input;
  const offeredId = offer?.roundId ?? null;
  return {
    powerUp: 'extra_joker',
    cost,
    maxUses,
    used: input.purchases.filter((p) => p.powerUp === 'extra_joker').length,
    // With no round offered, nothing matches: the "next round only" reason.
    outcome: outcomeOf(
      offeredId === null
        ? WRONG_ROUND
        : extraJokerRefusalOf(input, offeredId, offeredId),
    ),
    roundName:
      offer === null
        ? null
        : offer.title === ''
          ? `Round ${offer.roundNumber}`
          : offer.title,
  };
}
