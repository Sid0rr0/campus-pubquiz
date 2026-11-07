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

/** One entry per question power-up the session offers, in power-up order, with what the team can do with it now. The extra joker is not here. */
export function questionPowerUpOffer(
  input: QuestionOfferInput,
): PowerUpOfferEntry[] {
  return POWER_UP_IDS.filter(
    (powerUp) =>
      powerUp !== 'extra_joker' && input.settings[powerUp].maxUses > 0,
  ).map((powerUp) => {
    const { cost, maxUses } = input.settings[powerUp];
    const reason = refusalOf(powerUp, input.question, input);
    return {
      powerUp,
      cost,
      maxUses,
      used: input.purchases.filter((p) => p.powerUp === powerUp).length,
      outcome:
        reason === null
          ? { status: 'available' }
          : {
              status: HELD_BACK_REASONS.includes(reason)
                ? 'held_back'
                : 'unavailable',
              reason,
            },
    };
  });
}
