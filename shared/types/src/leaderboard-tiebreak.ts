import type { LeaderboardEntry } from './socket-events';

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
