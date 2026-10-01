import { rankTeams } from './ranking-rule';
import type { LeaderboardEntry } from './socket-events';

/** How many distinct ranks a kahootMode round's leaderboard shows — both the display's maxRank cap and how many teams its reveal walk needs to step through. Shared between frontend (leaderboard.tsx's maxRank, control/page.tsx's reveal-button gating) and backend (leaderboard-reveal.util.ts's reveal-count cap) so both sides agree on "top 5" without duplicating the number. */
export const KAHOOT_LEADERBOARD_TOP_N = 5;

/**
 * How many Advance steps the bottom-up leaderboard reveal
 * takes — one per tie group (see rankTeams), not per team, so a tie reveals
 * in a single step (matching the display's Leaderboard, which walks whole
 * rank groups). A kahootMode round only counts the groups within its
 * top-N cutoff, which still splits a tie that straddles the cutoff.
 */
export function getLeaderboardRevealStepCount(
  leaderboard: LeaderboardEntry[],
  isKahootRound: boolean,
): number {
  const ranked = rankTeams(leaderboard);
  const pool = isKahootRound
    ? ranked.slice(0, KAHOOT_LEADERBOARD_TOP_N)
    : ranked;
  return new Set(pool.map((entry) => entry.rank)).size;
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
