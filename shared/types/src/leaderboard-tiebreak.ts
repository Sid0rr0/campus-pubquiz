import { rankTeams } from './ranking-rule';
import type { LeaderboardEntry } from './room-views';

/** How many teams a kahootMode round's leaderboard shows — applied once, by capLeaderboard, for both the drawn board and the reveal walk's step count. */
export const KAHOOT_LEADERBOARD_TOP_N = 5;

/**
 * The teams a leaderboard shows: everyone, except in a kahootMode round, which
 * keeps the first KAHOOT_LEADERBOARD_TOP_N by final standing and splits a tie
 * that straddles the cutoff. The one place the cap lives — the drawn board and
 * the reveal walk's step count both read it.
 */
export function capLeaderboard(
  leaderboard: LeaderboardEntry[],
  isKahootRound: boolean,
): LeaderboardEntry[] {
  const ranked = rankTeams(leaderboard);
  return isKahootRound ? ranked.slice(0, KAHOOT_LEADERBOARD_TOP_N) : ranked;
}

/**
 * How many Advance steps the bottom-up leaderboard reveal
 * takes — one per tie group (see rankTeams), not per team, so a tie reveals
 * in a single step (matching the display's Leaderboard, which walks whole
 * rank groups), counted over the capped board.
 */
export function getLeaderboardRevealStepCount(
  leaderboard: LeaderboardEntry[],
  isKahootRound: boolean,
): number {
  const shown = capLeaderboard(leaderboard, isKahootRound);
  return new Set(shown.map((entry) => entry.rank)).size;
}

/**
 * Every team in the top tie group on the leaderboard, when 2 or more of
 * them are tied — empty when there's a single outright leader (or no
 * leaderboard at all). Order is preserved from `leaderboard` itself, which
 * computeLeaderboard sorts by points desc, name asc — that order becomes a
 * showdown round's seatIndex order.
 */
export function getTiedForFirst(
  leaderboard: LeaderboardEntry[],
): LeaderboardEntry[] {
  const firstPlaceIds = new Set(
    rankTeams(leaderboard)
      .filter((entry) => entry.rank === 1)
      .map((entry) => entry.teamId),
  );
  return firstPlaceIds.size >= 2
    ? leaderboard.filter((entry) => firstPlaceIds.has(entry.teamId))
    : [];
}
