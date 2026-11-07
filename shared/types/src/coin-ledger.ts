/** The session caches the Coin ledger reads (a `SessionState` fits). */
export interface CoinLedgerSession {
  seededGame: {
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
