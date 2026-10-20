import {
  displayedAveragePlacing,
  type TeamSessionRow,
  type TeamStatsSummary,
} from '@campus-pubquiz/types';

const PODIUM_PLACES = 3;

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** The placings a team earned: sessions it left have none. */
function placingsOf(rows: readonly TeamSessionRow[]): number[] {
  return rows.flatMap((row) => (row.placing === null ? [] : [row.placing]));
}

/**
 * A team's average placing to one decimal, or null when it has no placing.
 * The teams directory column and the team page both read it from here, so
 * the two always agree.
 */
export function averagePlacingOf(
  rows: readonly TeamSessionRow[],
): number | null {
  return displayedAveragePlacing(placingsOf(rows));
}

/**
 * A win is placing 1 *and* being the session's single Standings winner, so a
 * tie for first gives the win to one team only, matching the standings table.
 */
export function summarizeTeamHistory(
  rows: readonly TeamSessionRow[],
  winningSessionIds: ReadonlySet<number>,
): TeamStatsSummary {
  const placings = placingsOf(rows);
  // A session with no points to win has no share, so it stays out of the mean.
  const shares = rows
    .filter((row) => row.maxPoints > 0)
    .map((row) => (row.totalPoints / row.maxPoints) * 100);
  const playerCounts = rows.flatMap((row) =>
    row.playerCount === null ? [] : [row.playerCount],
  );
  return {
    sessionsPlayed: rows.length,
    wins: rows.filter(
      (row) => row.placing === 1 && winningSessionIds.has(row.gameSessionId),
    ).length,
    podiums: placings.filter((placing) => placing <= PODIUM_PLACES).length,
    bestPlacing: placings.length > 0 ? Math.min(...placings) : null,
    averagePlacing: averagePlacingOf(rows),
    averageSharePercent: mean(shares),
    averageTotalPoints: mean(rows.map((row) => row.totalPoints)),
    averagePlayerCount: mean(playerCounts),
  };
}
