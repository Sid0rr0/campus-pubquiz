import type {
  LeaderboardBoard,
  LeaderboardEntry,
  RankTrend,
} from '@campus-pubquiz/types';
import { selectLeaderboardRows } from '@/app/components/leaderboard-rows';

export interface MyStanding {
  entry: LeaderboardEntry;
  /** The server's rank movement for this team; absent for a team with no previous standing. */
  trend?: RankTrend;
}

/**
 * The team's own row, or null while the big screen has not revealed its rank
 * yet (the phone must not give away what the big screen is still building up
 * to) or when the board does not carry the team (a kahoot board keeps its top
 * five).
 */
export function findMyStanding(
  board: LeaderboardBoard,
  revealCount: number,
  teamId: number | null,
): MyStanding | null {
  if (teamId === null) return null;
  const row = selectLeaderboardRows({
    board,
    revealCount,
    phase: 'settled',
  }).find(({ entry }) => entry.teamId === teamId);
  if (!row) return null;
  return row.trend === undefined
    ? { entry: row.entry }
    : { entry: row.entry, trend: row.trend };
}
