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
  /** The team's joker round was in the block just scored: its row gets the 2× stamp. */
  isJokerStamped: boolean;
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
  // Stryker disable next-line ConditionalExpression: a null id matches no entry (ids are numbers), so the find below returns null anyway; the line only narrows the type
  if (teamId === null) return null;
  const row = selectLeaderboardRows({
    board,
    revealCount,
    phase: 'settled',
  }).find(({ entry }) => entry.teamId === teamId);
  if (!row) return null;
  const { entry, trend, isJokerStamped } = row;
  return trend === undefined
    ? { entry, isJokerStamped }
    : { entry, trend, isJokerStamped };
}
