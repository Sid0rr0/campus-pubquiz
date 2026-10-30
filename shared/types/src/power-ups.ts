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

/** A team's coins in a session, given its carried coin and the sum of its coin awards. Until purchases exist that is the starting coins plus both. */
export function teamCoins(
  settings: {
    powerUpsEnabled: boolean;
    startingCoins: number;
  },
  carriedCoin = 0,
  coinAwards = 0,
): number {
  return coinBalance({
    powerUpsEnabled: settings.powerUpsEnabled,
    startingCoins: settings.startingCoins,
    carriedCoin,
    coinAwards,
    purchaseCosts: 0,
  });
}
