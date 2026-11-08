import type { BonusCategory } from './bonus';
import { SHOT_SELFIE_COINS } from './power-ups';
import { coinAwardModeRefusal, type QuizMode } from './quiz-mode';

export const COINS_NEED_POWER_UPS_MESSAGE =
  'Coins can only be awarded in a session with power-ups';

/** The session caches the Coin ledger reads (a `SessionState` fits). */
export interface CoinLedgerSession {
  seededGame: {
    quizMode: QuizMode;
    settings: { powerUpsEnabled: boolean; startingCoins: number };
  };
  carriedCoins: Readonly<Record<number, number>>;
  coinAwards: Readonly<Record<number, number>>;
  funFactData: { powerUps: readonly { teamId: number; cost: number }[] };
}

/**
 * What a team has coming in minus its purchase costs, before the zero floor:
 * starting coins (only with power-ups on) + carried coins + coin awards - costs.
 * `purchases`, when given, are the team's stored purchases and replace the
 * cached ones (for a caller mid-write that holds fresher rows than the cache).
 */
function rawBalance(
  session: CoinLedgerSession,
  teamId: number,
  purchases?: readonly { cost: number }[],
): number {
  const { powerUpsEnabled, startingCoins } = session.seededGame.settings;
  const spent = (
    purchases ??
    session.funFactData.powerUps.filter(
      (purchase) => purchase.teamId === teamId,
    )
  ).reduce((sum, { cost }) => sum + cost, 0);
  return (
    (powerUpsEnabled ? startingCoins : 0) +
    (session.carriedCoins[teamId] ?? 0) +
    (session.coinAwards[teamId] ?? 0) -
    spent
  );
}

/** A team's coins, never below 0. */
export function coinBalance(
  session: CoinLedgerSession,
  teamId: number,
  purchases?: readonly { cost: number }[],
): number {
  return Math.max(0, rawBalance(session, teamId, purchases));
}

/** The coins a team has spent beyond what it has coming in: the debt `coinBalance`'s floor at 0 hides. */
export function coinDebt(
  session: CoinLedgerSession,
  teamId: number,
  purchases?: readonly { cost: number }[],
): number {
  return Math.max(0, -rawBalance(session, teamId, purchases));
}

/** The refusal for a coin award that needs power-ups on; undefined when allowed or when no coins are given. */
export function coinsNeedPowerUpsRefusal(
  powerUpsEnabled: boolean,
  coins: number | undefined,
): string | undefined {
  return coins && !powerUpsEnabled ? COINS_NEED_POWER_UPS_MESSAGE : undefined;
}

/** Why a coin award may not be given at all (quickfire session, power-ups off); undefined when allowed. */
export function coinAwardRefusal(
  session: CoinLedgerSession,
  coins: number | undefined,
): string | undefined {
  const { quizMode, settings } = session.seededGame;
  return (
    coinAwardModeRefusal(quizMode, coins) ??
    coinsNeedPowerUpsRefusal(settings.powerUpsEnabled, coins)
  );
}

/** The refusal for a take (negative coins) larger than the team's balance, so a balance never hides a debt; undefined otherwise. */
export function coinTakeRefusal(
  session: CoinLedgerSession,
  teamId: number,
  coins: number | undefined,
): string | undefined {
  if (coins === undefined || coins >= 0) return undefined;
  const balance = coinBalance(session, teamId);
  if (-coins <= balance) return undefined;
  return `That team has only ${balance} ${balance === 1 ? 'coin' : 'coins'} to take`;
}

/** The coins a covering coin award must give once the team's coin awards total `coinTotal` (a deleted award's coins were already spent); 0 when none. */
export function coinDebtCover(
  session: CoinLedgerSession,
  teamId: number,
  coinTotal: number,
): number {
  return coinDebt(
    { ...session, coinAwards: { ...session.coinAwards, [teamId]: coinTotal } },
    teamId,
  );
}

/** Whether a team's coins are shown: power-ups on, or the team holds coins anyway (a carried coin). A quickfire session has neither. */
export function coinsShown(powerUpsEnabled: boolean, balance: number): boolean {
  return powerUpsEnabled || balance > 0;
}

/** The coins a bonus award earns by itself: a shot or selfie with positive points and power-ups on; else 0. */
export function bonusCoinsEarned(
  powerUpsEnabled: boolean,
  category: BonusCategory,
  points: number,
): number {
  return powerUpsEnabled && category !== 'custom' && points > 0
    ? SHOT_SELFIE_COINS
    : 0;
}
