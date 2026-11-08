import { doubledRoundIds } from './doubled-rounds';
import {
  POWER_UP_IDS,
  powerUpApplies,
  type PowerUpId,
  type PowerUpSettings,
} from './power-ups';
import type { QuestionType } from './question-types';

/** The question a power-up would be bought for: one that can be answered now. */
export interface OfferedQuestion {
  id: number;
  type: QuestionType;
  options?: readonly string[];
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

/** A refusal's wording, and whether only coins or Ask the room's readiness stand in the way. */
interface Refusal {
  reason: string;
  heldBack: boolean;
}

const refused = (reason: string): Refusal => ({ reason, heldBack: false });
const heldBack = (reason: string): Refusal => ({ reason, heldBack: true });

const NOT_ENOUGH_COINS = 'Not enough coins';
const WRONG_ROUND = 'Only the next round can be doubled, before its intro';

/** The power-up's offer entry minus its outcome. */
function entryOf(
  powerUp: PowerUpId,
  settings: PowerUpSettings,
  purchases: readonly { powerUp: PowerUpId }[],
) {
  const { cost, maxUses } = settings[powerUp];
  return {
    powerUp,
    cost,
    maxUses,
    used: purchases.filter((p) => p.powerUp === powerUp).length,
  };
}

/** Why `powerUp` can't be bought on `question` now (worded for the team), or null. The order is the server's. */
function refusalOf(
  powerUp: PowerUpId,
  question: OfferedQuestion | null,
  input: QuestionOfferInput,
): Refusal | null {
  if (question === null) return refused('Answers are locked for this question');
  if (!powerUpApplies(powerUp, question)) {
    return refused('That power-up does not work on this question');
  }
  const { cost, maxUses, used } = entryOf(
    powerUp,
    input.settings,
    input.purchases,
  );
  if (maxUses === 0) return refused('That power-up is not offered');
  if (used >= maxUses) {
    return refused('You have reached the limit for that power-up');
  }
  if (
    input.purchases.some(
      (p) => p.powerUp === powerUp && p.questionId === question.id,
    )
  ) {
    return refused('You already used that power-up on this question');
  }
  if (input.balance < cost) return heldBack(NOT_ENOUGH_COINS);
  if (powerUp === 'ask_the_room' && !input.isRoomReady) {
    return heldBack('Waiting for more answers');
  }
  return null;
}

/** Why buying `powerUp` for `questionId` is refused, or null when it goes through. A question other than the offered one counts as locked. */
export function questionPurchaseRefusal(
  input: QuestionOfferInput & { powerUp: PowerUpId; questionId: number },
): string | null {
  const { question, powerUp, questionId } = input;
  return (
    refusalOf(powerUp, question?.id === questionId ? question : null, input)
      ?.reason ?? null
  );
}

function outcomeOf(refusal: Refusal | null): OfferOutcome {
  if (refusal === null) return { status: 'available' };
  return {
    status: refusal.heldBack ? 'held_back' : 'unavailable',
    reason: refusal.reason,
  };
}

/** One entry per question power-up the session offers, in power-up order, with what the team can do with it now. The extra joker is not here. */
export function questionPowerUpOffer(
  input: QuestionOfferInput,
): PowerUpOfferEntry[] {
  return POWER_UP_IDS.filter(
    (powerUp) =>
      powerUp !== 'extra_joker' && input.settings[powerUp].maxUses > 0,
  ).map((powerUp) => ({
    ...entryOf(powerUp, input.settings, input.purchases),
    outcome: outcomeOf(refusalOf(powerUp, input.question, input)),
  }));
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
): Refusal | null {
  const { cost, maxUses, used } = entryOf(
    'extra_joker',
    input.settings,
    input.purchases,
  );
  if (maxUses === 0) return refused('That power-up is not offered');
  if (roundId !== offeredRoundId) return refused(WRONG_ROUND);
  const doubled = doubledRoundIds(
    input.jokerRoundId ?? undefined,
    input.purchases,
  );
  if (doubled.includes(roundId))
    return refused('That round is already doubled');
  if (used >= maxUses) {
    return refused('You have reached the limit for that power-up');
  }
  return input.balance < cost ? heldBack(NOT_ENOUGH_COINS) : null;
}

/** Why buying an extra joker for `roundId` is refused, or null when it goes through. `offeredRoundId` is what `extraJokerRoundId` says is on offer. */
export function extraJokerPurchaseRefusal(
  input: ExtraJokerRuleInput & {
    roundId: number;
    offeredRoundId: number | null;
  },
): string | null {
  return (
    extraJokerRefusalOf(input, input.roundId, input.offeredRoundId)?.reason ??
    null
  );
}

export interface ExtraJokerOfferEntry extends PowerUpOfferEntry {
  /** The offered round as the card names it (its title, or "Round N"); null when no round is offered. */
  roundName: string | null;
}

/** The extra joker's entry with what the team can do with it now, or null when the session does not offer it. */
export function extraJokerOfferEntry(
  input: ExtraJokerRuleInput & { offer: OfferedRound | null },
): ExtraJokerOfferEntry | null {
  const entry = entryOf('extra_joker', input.settings, input.purchases);
  if (entry.maxUses === 0) return null;
  const { offer } = input;
  const offeredId = offer?.roundId ?? null;
  return {
    ...entry,
    // With no round offered, nothing matches: the "next round only" reason.
    outcome: outcomeOf(
      offeredId === null
        ? refused(WRONG_ROUND)
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
