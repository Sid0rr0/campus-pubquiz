import type {
  LeaderboardBoard,
  LeaderboardEntry,
  RankTrend,
} from '@campus-pubquiz/types';
import { formatRankLabel } from '@/app/lib/rank-label';

/**
 * The three-beat sequence a board with a count-up board plays: hold the old
 * board, count scores up in place, then reorder rows. A board with no
 * count-up board is always 'settled'.
 */
export type LeaderboardPhase = 'old' | 'counting' | 'settled';

export interface LeaderboardRowsInput {
  /** The leaderboard exactly as the server described it: capped entries, trends, and the count-up board when there is one. */
  board: LeaderboardBoard;
  /**
   * How many teams, counting up from last place, are currently revealed.
   * Omit to show every team immediately with no reveal animation.
   */
  revealCount?: number;
  /** Where the old-state animation is: which board the rows are drawn from. */
  phase: LeaderboardPhase;
}

export interface LeaderboardRow {
  /** The entry to draw: the old one in 'old', the new one in 'counting' and 'settled'. */
  entry: LeaderboardEntry;
  /**
   * 0-based rank, relative to the full standings (or, while animating, among
   * the teams on their old totals).
   */
  rankIndex: number;
  /** "2." for a clear place, "2.–4." for a tie group. */
  label: string;
  /** Rank movement as sent by the server; only in 'settled'. */
  trend?: RankTrend;
}

/** The entries in their own (server-ranked) order, with the sent trends. */
function settledRows({ entries, trends }: LeaderboardBoard): LeaderboardRow[] {
  return entries.map((entry) => ({
    entry,
    rankIndex: entry.rank - 1,
    label: formatRankLabel(entry),
    ...(trends[entry.teamId] === undefined
      ? {}
      : { trend: trends[entry.teamId] }),
  }));
}

/**
 * The teams on their old totals, in old order. 'counting' swaps in each
 * team's new entry so its total can count up while the row stays put.
 */
function oldStateRows(
  { entries }: LeaderboardBoard,
  countUpBoard: LeaderboardEntry[],
  phase: LeaderboardPhase,
): LeaderboardRow[] {
  const entriesByTeamId = new Map(
    entries.map((entry) => [entry.teamId, entry]),
  );
  return countUpBoard.map((oldEntry) => ({
    entry:
      phase === 'counting'
        ? (entriesByTeamId.get(oldEntry.teamId) ?? oldEntry)
        : oldEntry,
    rankIndex: oldEntry.rank - 1,
    label: formatRankLabel(oldEntry),
  }));
}

/**
 * Chunks rows (already ordered by rank, so equal ranks are contiguous) into
 * one array per distinct rank — a tie becomes a single multi-row group.
 */
function groupByRank(rows: LeaderboardRow[]): LeaderboardRow[][] {
  return rows.reduce<LeaderboardRow[][]>((groups, row) => {
    const currentGroup = groups.at(-1);
    return currentGroup && currentGroup[0].rankIndex === row.rankIndex
      ? [...groups.slice(0, -1), [...currentGroup, row]]
      : [...groups, [row]];
  }, []);
}

/**
 * Keeps the bottom `revealCount` rank groups of the rows, so the walk counts
 * distinct ranks (a tie reveals in one step) and always reaches rank 1 once
 * it covers every group. Omitted shows every row.
 */
function revealBottomUp(
  rows: LeaderboardRow[],
  revealCount: number | undefined,
): LeaderboardRow[] {
  if (revealCount === undefined) return rows;
  const rankGroups = groupByRank(rows);
  const visibleGroupCount = Math.min(
    Math.max(revealCount, 0),
    rankGroups.length,
  );
  return rankGroups.slice(rankGroups.length - visibleGroupCount).flat();
}

/**
 * The rows the leaderboard shows, in order. While the count-up board is
 * animating ('old'/'counting') every team shows on its old total and the
 * reveal walk isn't a meaningful cut; once settled the entries show as sent,
 * revealed bottom-up, with the sent trends.
 */
export function selectLeaderboardRows({
  board,
  revealCount,
  phase,
}: LeaderboardRowsInput): LeaderboardRow[] {
  if (phase !== 'settled' && board.countUpBoard !== undefined) {
    return oldStateRows(board, board.countUpBoard, phase);
  }
  return revealBottomUp(settledRows(board), revealCount);
}
