import { z } from 'zod';
import { QUESTION_KINDS } from './question-kind';
import type { QuestionType } from './question-types';

export const POWER_UP_IDS = [
  'fifty_fifty',
  'first_letter',
  'letter_count',
  'pin_one',
  'wider_margin',
  'ask_the_room',
  'extra_joker',
] as const;

export type PowerUpId = (typeof POWER_UP_IDS)[number];

/** What a session charges for one power-up and how often a team may use it; `maxUses` 0 means the power-up is not offered. */
export interface PowerUpSetting {
  cost: number;
  maxUses: number;
}

export type PowerUpSettings = Record<PowerUpId, PowerUpSetting>;

export const POWER_UP_LABELS: Record<PowerUpId, string> = {
  fifty_fifty: '50/50',
  first_letter: 'First letter',
  letter_count: 'Letter count',
  pin_one: 'Pin one',
  wider_margin: 'Wider margin',
  ask_the_room: 'Ask the room',
  extra_joker: 'Extra joker',
};

export const DEFAULT_STARTING_COINS = 1;

/** The extra joker's default cost: 3 when the round overview names the round, 2 when the team buys it blind. */
export function defaultExtraJokerCost(showRoundOverview: boolean): number {
  return showRoundOverview ? 3 : 2;
}

/** The default power-up table for a session with the given round overview setting. */
export function defaultPowerUpSettings(
  showRoundOverview: boolean,
): PowerUpSettings {
  const table = Object.fromEntries(
    POWER_UP_IDS.map((id) => [id, { cost: 1, maxUses: 1 }]),
  ) as PowerUpSettings;
  table.ask_the_room.cost = 2;
  table.extra_joker.cost = defaultExtraJokerCost(showRoundOverview);
  return table;
}

/**
 * What a purchase stored, one member per power-up that stores something, keyed
 * by `kind`. A new power-up adds a member here and to `purchaseEffectSchema`;
 * the purchase row and the socket event stay as they are.
 */
export type PurchaseEffect =
  | { kind: 'fifty_fifty'; removedOptions: string[] }
  | { kind: 'ask_the_room'; split: Record<string, number> }
  | { kind: TextHintId; hint: string }
  | { kind: 'wider_margin' };

/** The free-text power-ups: each stores the hint worked out from the key at purchase time. */
export type TextHintId = 'first_letter' | 'letter_count';

export const purchaseEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('wider_margin') }),
  z.object({
    kind: z.literal('ask_the_room'),
    split: z.record(z.string(), z.number()),
  }),
  z.object({
    kind: z.literal('fifty_fifty'),
    removedOptions: z.array(z.string()),
  }),
  z.object({
    kind: z.enum(['first_letter', 'letter_count']),
    hint: z.string(),
  }),
]) satisfies z.ZodType<PurchaseEffect>;

/** A team's own purchase as its phone gets it (never another team's). `questionId` or `roundId` names what it was bought for. */
export interface PurchaseView {
  powerUp: PowerUpId;
  questionId: number | null;
  roundId: number | null;
  effect: PurchaseEffect;
}

/** A team's own purchases, pushed to its phones alone after a purchase (and carried by the join reply), with the coins left. */
export interface TeamPurchasesSyncedPayload {
  purchases: PurchaseView[];
  coins: number;
}

/** The single client-to-server event to buy a power-up on a question. */
export interface BuyPowerUpPayload {
  powerUp: PowerUpId;
  questionId: number;
}

/** How many options a 50/50 leaves: half, rounded down, never fewer than two. */
export function fiftyFiftyLeaveCount(optionCount: number): number {
  return Math.max(2, Math.floor(optionCount / 2));
}

/**
 * The options a 50/50 removes: a random choice of all but `fiftyFiftyLeaveCount`
 * of them, never `correct`. Returned in option order. `random` is in [0, 1).
 */
export function drawRemovedOptions(
  options: readonly string[],
  correct: string,
  random: () => number,
): string[] {
  const pool = options.filter((option) => option !== correct);
  const removeCount = options.length - fiftyFiftyLeaveCount(options.length);
  const removed = new Set<string>();
  for (let i = 0; i < removeCount; i += 1) {
    const index = Math.min(Math.floor(random() * pool.length), pool.length - 1);
    removed.add(pool.splice(index, 1)[0]);
  }
  return options.filter((option) => removed.has(option));
}

/** The hint a free-text power-up shows for `answer`: its literal first character, or the answer with each letter and digit as `_` (spaces and punctuation kept). */
export function textHint(powerUp: TextHintId, answer: string): string {
  const key = answer.trim();
  return powerUp === 'first_letter'
    ? (Array.from(key)[0] ?? '')
    : key.replace(/[\p{L}\p{N}]/gu, '_');
}

/** How many other teams must have a current answer before Ask the room can be bought. */
export const ASK_THE_ROOM_MIN_ANSWERS = 3;

/**
 * Ask the room's split: each option's whole-percent share of the other teams'
 * current answers (summing to 100, largest remainders rounded up), or null
 * below `ASK_THE_ROOM_MIN_ANSWERS` answers. An answer that is no option counts
 * towards the threshold but not the shares.
 */
export function askTheRoomSplit(
  options: readonly string[],
  answers: readonly string[],
): Record<string, number> | null {
  if (answers.length < ASK_THE_ROOM_MIN_ANSWERS) return null;
  const counts = options.map(
    (option) => answers.filter((answer) => answer === option).length,
  );
  const total = counts.reduce((a, b) => a + b, 0);
  const shares = counts.map((count) =>
    total === 0 ? 0 : Math.floor((count * 100) / total),
  );
  const byRemainder = counts
    .map((count, i) => ({ i, rest: total === 0 ? 0 : (count * 100) % total }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  const leftover = total === 0 ? 0 : 100 - shares.reduce((a, b) => a + b, 0);
  for (const { i } of byRemainder.slice(0, leftover)) shares[i] += 1;
  return Object.fromEntries(options.map((option, i) => [option, shares[i]]));
}

/** Whether a power-up can be used on this question at all: its type lists the power-up (the registry's `powerUps`), and a 50/50 needs more than two options. */
export function powerUpApplies(
  powerUp: PowerUpId,
  question: { type: QuestionType; options?: readonly string[] },
): boolean {
  if (!QUESTION_KINDS[question.type].powerUps.includes(powerUp)) return false;
  return powerUp !== 'fifty_fifty' || (question.options?.length ?? 0) > 2;
}

/** Why a purchase is refused (worded for the team), or null when it goes through. */
export function purchaseRefusal(input: {
  setting: PowerUpSetting;
  /** How many times the team has bought this power-up this session. */
  usesInSession: number;
  isUsedOnQuestion: boolean;
  balance: number;
  isAnswerable: boolean;
  applies: boolean;
}): string | null {
  if (!input.isAnswerable) return 'Answers are locked for this question';
  if (!input.applies) return 'That power-up does not work on this question';
  if (input.setting.maxUses === 0) return 'That power-up is not offered';
  if (input.usesInSession >= input.setting.maxUses) {
    return 'You have reached the limit for that power-up';
  }
  if (input.isUsedOnQuestion) {
    return 'You already used that power-up on this question';
  }
  if (input.balance < input.setting.cost) return 'Not enough coins';
  return null;
}

/** The question's options minus those the team's 50/50s on it removed. */
export function optionsAfterPurchases(
  questionId: number,
  options: readonly string[],
  purchases: readonly PurchaseView[],
): string[] {
  const removed = new Set(
    purchases.flatMap(({ questionId: boughtFor, effect }) =>
      boughtFor === questionId && effect.kind === 'fifty_fifty'
        ? effect.removedOptions
        : [],
    ),
  );
  return options.filter((option) => !removed.has(option));
}

/** The ledger a team's coins are worked out from. */
export interface CoinLedger {
  powerUpsEnabled: boolean;
  startingCoins: number;
  carriedCoin: number;
  /** Sum of the team's coin awards (may be negative). */
  coinAwards: number;
  /** Sum of the costs of the team's purchases. */
  purchaseCosts: number;
}

/** A team's coins: starting coins (only with power-ups on) + carried coin + coin awards - purchases, never below 0. */
export function coinBalance(ledger: CoinLedger): number {
  const starting = ledger.powerUpsEnabled ? ledger.startingCoins : 0;
  return Math.max(
    0,
    starting + ledger.carriedCoin + ledger.coinAwards - ledger.purchaseCosts,
  );
}

/** A team's coins in a session, given its carried coin, the sum of its coin awards and the sum of its purchase costs. */
export function teamCoins(
  settings: {
    powerUpsEnabled: boolean;
    startingCoins: number;
  },
  carriedCoin = 0,
  coinAwards = 0,
  purchaseCosts = 0,
): number {
  return coinBalance({
    powerUpsEnabled: settings.powerUpsEnabled,
    startingCoins: settings.startingCoins,
    carriedCoin,
    coinAwards,
    purchaseCosts,
  });
}

/** The sum of the costs of one team's purchases among `purchases` (the figure `teamCoins` subtracts). */
export function purchaseCostsOf(
  purchases: readonly { teamId: number; cost: number }[],
  teamId: number,
): number {
  return purchases
    .filter((purchase) => purchase.teamId === teamId)
    .reduce((sum, purchase) => sum + purchase.cost, 0);
}

/** How many times one power-up was used on the revealed question. */
export interface PowerUpCount {
  powerUp: PowerUpId;
  count: number;
}

/** The power-ups used on `questionId`, counted per power-up in registry order, those never used left out. No team is named. */
export function powerUpCountsFor(
  questionId: number,
  purchases: readonly { powerUp: PowerUpId; questionId: number | null }[],
): PowerUpCount[] {
  return POWER_UP_IDS.map((powerUp) => ({
    powerUp,
    count: purchases.filter(
      (purchase) =>
        purchase.powerUp === powerUp && purchase.questionId === questionId,
    ).length,
  })).filter(({ count }) => count > 0);
}
