import type { LeaderboardEntry } from './socket-events';

/** How many distinct ranks a kahootMode round's leaderboard shows — both the display's maxRank cap and how many teams its reveal walk needs to step through. Shared between frontend (leaderboard.tsx's maxRank, control/page.tsx's reveal-button gating) and backend (leaderboard-reveal.util.ts's reveal-count cap) so both sides agree on "top 5" without duplicating the number. */
export const KAHOOT_LEADERBOARD_TOP_N = 5;

/**
 * Every team sharing the top `totalPoints` on the leaderboard, when 2 or
 * more of them are tied — empty when there's a single outright leader (or
 * no leaderboard at all). Order is preserved from `leaderboard` itself,
 * which computeLeaderboard sorts by points desc, name asc — that order
 * becomes a showdown round's seatIndex order.
 */
export function getTiedForFirst(
  leaderboard: LeaderboardEntry[],
): LeaderboardEntry[] {
  if (leaderboard.length < 2) return [];
  const topPoints = leaderboard[0].totalPoints;
  const tied = leaderboard.filter((entry) => entry.totalPoints === topPoints);
  return tied.length >= 2 ? tied : [];
}
