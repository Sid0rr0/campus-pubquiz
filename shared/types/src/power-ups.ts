import { z } from 'zod';
import { pickableRounds } from './joker';
import { QUESTION_KINDS } from './question-kind';
import type { QuestionType } from './question-types';
import { splitPipeList } from './sort-match';

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

/** One player-facing sentence per power-up: what it does, in the power-ups list and on /how-to-play. */
export const POWER_UP_DESCRIPTIONS: Record<PowerUpId, string> = {
  fifty_fifty: 'Removes half the options, never the right one.',
  first_letter: "Shows the answer's first letter.",
  letter_count: 'Shows the answer with its letters as blanks.',
  pin_one: 'Locks one item or pair in its right place.',
  wider_margin: "Doubles a Number question's margin.",
  ask_the_room:
    "Shows how the other teams' answers split, once three have answered.",
  extra_joker: 'Doubles the next round, if bought before its intro.',
};

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
  | { kind: 'wider_margin' }
  | PinEffect
  | { kind: 'extra_joker' };

/** The free-text power-ups: each stores the hint worked out from the key at purchase time. */
export type TextHintId = 'first_letter' | 'letter_count';

/** A pin: `item` belongs at `position` (0-based) of the sort order, or of the right-hand column of a match (aligned to the left items). */
export interface PinEffect {
  kind: 'pin_one';
  item: string;
  position: number;
}

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
  z.object({
    kind: z.literal('pin_one'),
    item: z.string(),
    position: z.number().int().min(0),
  }),
  z.object({ kind: z.literal('extra_joker') }),
]) satisfies z.ZodType<PurchaseEffect>;

/** Pins one item of the answer key (a pipe list, sort order or match right-hand column). `random` is in [0, 1). */
export function drawPin(answer: string, random: () => number): PinEffect {
  const items = splitPipeList(answer);
  const position = Math.min(
    Math.floor(random() * items.length),
    items.length - 1,
  );
  return { kind: 'pin_one', item: items[position], position };
}

/** `order` with the pinned item put at its place and the rest kept in order; unchanged without a pin. */
export function lockPin(
  order: readonly string[],
  pin: PinEffect | undefined,
): string[] {
  if (!pin || !order.includes(pin.item)) return [...order];
  const rest = order.filter((item) => item !== pin.item);
  rest.splice(pin.position, 0, pin.item);
  return rest;
}

/** The pin a team bought for `questionId`, if any. */
export function pinFor(
  questionId: number,
  purchases: readonly PurchaseView[],
): PinEffect | undefined {
  for (const purchase of purchases) {
    if (
      purchase.questionId === questionId &&
      purchase.effect.kind === 'pin_one'
    ) {
      return purchase.effect;
    }
  }
  return undefined;
}

/** A team's own purchase as its phone gets it (never another team's). `questionId` or `roundId` names what it was bought for. */
export interface PurchaseView {
  powerUp: PowerUpId;
  questionId: number | null;
  roundId: number | null;
  effect: PurchaseEffect;
  /** The round an extra joker doubles, so the phone can name it; its title is "" with the round overview off, as in the offer. */
  round?: { roundNumber: number; title: string };
}

/** A team's own purchases, pushed to its phones alone after a purchase (and carried by the join reply), with the coins left. */
export interface TeamPurchasesSyncedPayload {
  purchases: PurchaseView[];
  coins: number;
}

/** Whether the team's Ask the room is ready on one question, pushed to that team's phones alone whenever another team's answer lands (never a count of teams). */
export interface TeamRoomReadySyncedPayload {
  questionId: number;
  isReady: boolean;
}

/** The single client-to-server event to buy a power-up: on a question, or (the extra joker) for a round. */
export type BuyPowerUpPayload =
  | { powerUp: PowerUpId; questionId: number; roundId?: undefined }
  | { powerUp: 'extra_joker'; roundId: number; questionId?: undefined };

/** The statuses before any round intro has been on air. */
const BEFORE_FIRST_INTRO: readonly string[] = [
  'lobby',
  'rules',
  'round_overview',
  'joker_pick',
];

/**
 * The round an extra joker can be bought for right now: the first round with
 * no opened question whose intro has not been on air (the current round's
 * intro is on air or past in every status after the joker pick). Null when
 * there is none.
 */
export function extraJokerRoundId(session: {
  seededGame: {
    rounds: readonly { id: number; questions: readonly { id: number }[] }[];
  };
  openedQuestionIds: readonly number[];
  progress: { status: string; roundIndex: number };
}): number | null {
  const { rounds } = session.seededGame;
  const { status, roundIndex } = session.progress;
  if (status === 'ended') return null;
  const lastIntroIndex = BEFORE_FIRST_INTRO.includes(status) ? -1 : roundIndex;
  return (
    pickableRounds(rounds, session.openedQuestionIds).find(
      (round) => rounds.indexOf(round) > lastIntroIndex,
    )?.id ?? null
  );
}

/** Why an extra joker for `roundId` is refused (worded for the team), or null when it goes through. */
export function extraJokerRefusal(input: {
  setting: PowerUpSetting;
  usesInSession: number;
  balance: number;
  roundId: number;
  /** What `extraJokerRoundId` says is on offer. */
  offeredRoundId: number | null;
  /** Rounds the team already doubles: its joker round and earlier extra jokers. */
  doubledRoundIds: readonly number[];
}): string | null {
  if (input.setting.maxUses === 0) return 'That power-up is not offered';
  if (input.roundId !== input.offeredRoundId) {
    return 'Only the next round can be doubled, before its intro';
  }
  if (input.doubledRoundIds.includes(input.roundId)) {
    return 'That round is already doubled';
  }
  if (input.usesInSession >= input.setting.maxUses) {
    return 'You have reached the limit for that power-up';
  }
  if (input.balance < input.setting.cost) return 'Not enough coins';
  return null;
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
 * below `ASK_THE_ROOM_MIN_ANSWERS` answers that match an option. An answer that
 * is no option counts towards neither the threshold nor the shares.
 */
export function askTheRoomSplit(
  options: readonly string[],
  answers: readonly string[],
): Record<string, number> | null {
  const counts = options.map(
    (option) => answers.filter((answer) => answer === option).length,
  );
  const total = counts.reduce((a, b) => a + b, 0);
  if (total < ASK_THE_ROOM_MIN_ANSWERS) return null;
  const shares = counts.map((count) => Math.floor((count * 100) / total));
  const byRemainder = counts
    .map((count, i) => ({ i, rest: (count * 100) % total }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  const leftover = 100 - shares.reduce((a, b) => a + b, 0);
  for (const { i } of byRemainder.slice(0, leftover)) shares[i] += 1;
  return Object.fromEntries(options.map((option, i) => [option, shares[i]]));
}

/** Whether Ask the room would go through on `question` for `teamId` now: it works there and enough other teams have a current option-matching answer. Says nothing of how many. */
export function askTheRoomReady(
  question: { type: QuestionType; options?: readonly string[] },
  answers: readonly { teamId: number; value: string }[],
  teamId: number,
): boolean {
  return (
    powerUpApplies('ask_the_room', question) &&
    askTheRoomSplit(
      question.options ?? [],
      answers
        .filter((answer) => answer.teamId !== teamId)
        .map((answer) => answer.value),
    ) !== null
  );
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

/** The options the team's 50/50s on the question removed. */
export function removedOptionsOf(
  questionId: number,
  purchases: readonly PurchaseView[],
): string[] {
  return purchases.flatMap(({ questionId: boughtFor, effect }) =>
    boughtFor === questionId && effect.kind === 'fifty_fifty'
      ? effect.removedOptions
      : [],
  );
}

/** The question's options minus those the team's 50/50s on it removed. */
export function optionsAfterPurchases(
  questionId: number,
  options: readonly string[],
  purchases: readonly PurchaseView[],
): string[] {
  const removed = new Set(removedOptionsOf(questionId, purchases));
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

/** A team's coins read from a session's caches: its settings, the team's carried coin and coin award sum, and the purchases in `funFactData`. */
export function coinBalanceOf(
  session: {
    seededGame: { settings: Parameters<typeof teamCoins>[0] };
    carriedCoins: Readonly<Record<number, number>>;
    coinAwards: Readonly<Record<number, number>>;
    funFactData: { powerUps: readonly { teamId: number; cost: number }[] };
  },
  teamId: number,
): number {
  return teamCoins(
    session.seededGame.settings,
    session.carriedCoins[teamId],
    session.coinAwards[teamId],
    purchaseCostsOf(session.funFactData.powerUps, teamId),
  );
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
