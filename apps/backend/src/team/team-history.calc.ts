import {
  displayedAveragePlacing,
  type TeamSessionRow,
  type TeamStatsSummary,
} from '@campus-pubquiz/types';
import type { SessionResult } from '@/standings/session-result';

const PODIUM_PLACES = 3;

/** A session a team took part in: its display facts and the Session result. */
export interface TeamHistorySession {
  gameSessionId: number;
  name: string;
  playedAt: string; // ISO
  result: SessionResult;
  /** Null when the team reported no player count for the session. */
  playerCount: number | null;
}

/**
 * The team's session rows (in the order given) and how many of those nights it
 * won, read from the Session result. Sessions the team has no result in are
 * skipped.
 */
export function teamHistoryOf(
  teamId: number,
  sessions: readonly TeamHistorySession[],
): { rows: TeamSessionRow[]; nightsWon: number } {
  const rows: TeamSessionRow[] = [];
  let nightsWon = 0;
  for (const session of sessions) {
    const team = session.result.teams.find((t) => t.teamId === teamId);
    if (!team) continue;
    rows.push({
      gameSessionId: session.gameSessionId,
      name: session.name,
      playedAt: session.playedAt,
      placing: team.placing,
      placingTo: team.placingTo,
      teamCount: session.result.participantCount,
      hasLeft: team.hasLeft,
      totalPoints: team.totalPoints,
      maxPoints: session.result.maxPoints,
      correctCount: team.correctCount,
      playerCount: session.playerCount,
    });
    if (team.wonNight) nightsWon += 1;
  }
  return { rows, nightsWon };
}

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
 * `nightsWon` is how many of the rows were a night won (placing 1, ties
 * included), counted by the Session result module.
 */
export function summarizeTeamHistory(
  rows: readonly TeamSessionRow[],
  nightsWon: number,
): TeamStatsSummary {
  const placings = placingsOf(rows);
  // A session with no points to win has no share, so it stays out of the mean.
  // A joker (or bonus) can take a total past the quiz maximum: a share caps at 100%.
  const shares = rows
    .filter((row) => row.maxPoints > 0)
    .map((row) => Math.min((row.totalPoints / row.maxPoints) * 100, 100));
  const playerCounts = rows.flatMap((row) =>
    row.playerCount === null ? [] : [row.playerCount],
  );
  return {
    sessionsPlayed: rows.length,
    wins: nightsWon,
    podiums: placings.filter((placing) => placing <= PODIUM_PLACES).length,
    bestPlacing: placings.length > 0 ? Math.min(...placings) : null,
    averagePlacing: averagePlacingOf(rows),
    averageSharePercent: mean(shares),
    averageTotalPoints: mean(rows.map((row) => row.totalPoints)),
    averagePlayerCount: mean(playerCounts),
  };
}
