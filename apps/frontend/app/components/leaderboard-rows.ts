import {
  isQuestionOnAirStatus,
  rankTeams,
  type GameStatus,
  type LeaderboardEntry,
} from '@campus-pubquiz/types';
import { formatRankLabel } from '@/app/lib/rank-label';

/**
 * The three-beat sequence `previousEntries` drives: hold the old board, count
 * scores up in place, then reorder rows. A leaderboard with no old state to
 * animate from is always 'settled'.
 */
export type LeaderboardPhase = 'old' | 'counting' | 'settled';

export interface LeaderboardRowsInput {
  /** Current standings, already ranked by the server. */
  entries: LeaderboardEntry[];
  /**
   * How many teams, counting up from last place, are currently revealed.
   * Omit to show every team immediately with no reveal animation (e.g. the
   * admin's own always-visible preview).
   */
  revealCount?: number;
  /**
   * A hard cap on how many teams are shown (e.g. KAHOOT_LEADERBOARD_TOP_N
   * for a Kahoot round) — the first `maxRank` by final standing, splitting a
   * tie at the cutoff rather than growing the list to fit it whole.
   * Composed with revealCount when both are given: an entry renders only if
   * it satisfies both. Omit to show every team.
   */
  maxRank?: number;
  /**
   * Standings exactly as they were before `entries`' current point totals
   * were applied — e.g. the board right before a Kahoot question's results
   * landed. When given, the leaderboard opens on this old state, holds it,
   * counts each team's score up to its new total, then reorders rows into
   * their new standings, instead of rendering straight at the final state.
   * Also doubles as the trend-icon basis (see `trendBaseline`, which this
   * takes priority over). Omit for every other leaderboard view (the
   * round-end/quiz-end reveal, the admin's own preview), which should still
   * render `entries` directly. An empty array (rather than omitting the
   * prop) means the same animation is wanted but no real old board exists
   * yet — the game's very first Kahoot question, before any leaderboard has
   * ever been computed — and is treated as every currently-shown team
   * starting from 0.
   */
  previousEntries?: LeaderboardEntry[];
  /** Where the old-state animation is: which board the rows are drawn from. */
  phase: LeaderboardPhase;
}

export interface LeaderboardRow {
  /** The entry to draw: the old one in 'old', the new one in 'counting' and 'settled'. */
  entry: LeaderboardEntry;
  /** 0-based rank, relative to the full standings (or the old pool while animating). */
  rankIndex: number;
  /** "2." for a clear place, "2.–4." for a tie group. */
  label: string;
}

function zeroedOutEntry(entry: LeaderboardEntry): LeaderboardEntry {
  return {
    ...entry,
    totalPoints: 0,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  };
}

/**
 * The full-roster old board: `previousEntries` itself, or — when it was
 * passed as `[]` (no leaderboard has ever been computed yet, e.g. the game's
 * first Kahoot question) — the whole current roster zeroed out. Always the
 * full roster, never capped to `maxRank`, so a trend comparison ranks a team
 * among every team, not just the on-screen top N.
 */
export function fullPreviousBoard(
  entries: LeaderboardEntry[],
  previousEntries: LeaderboardEntry[] | undefined,
): LeaderboardEntry[] | undefined {
  if (previousEntries === undefined) return undefined;
  if (previousEntries.length > 0 || entries.length === 0)
    return previousEntries;
  return entries.map(zeroedOutEntry);
}

function capToMaxRank<T>(items: T[], maxRank: number | undefined): T[] {
  return maxRank === undefined ? items : items.slice(0, maxRank);
}

/**
 * The exact teams that will end up on screen once the board settles — the
 * first `maxRank` of `entries` by final standing — each paired with its
 * value on `fullOldEntries` where one exists, or 0 for a team with no prior
 * record there. Deliberately capped by the *final* standing, not by the old
 * board's own ranking: the old board can have no ties where the new one has
 * a large tied group, and an old-ranking cap could then hold and count up
 * entirely different teams than the ones the board settles into.
 */
function oldPoolEntries(
  entries: LeaderboardEntry[],
  fullOldEntries: LeaderboardEntry[],
  maxRank: number | undefined,
): LeaderboardEntry[] {
  const finalPoolTeamIds = new Set(
    capToMaxRank(entries, maxRank).map((entry) => entry.teamId),
  );
  const oldTeamIds = new Set(fullOldEntries.map((entry) => entry.teamId));
  const fromOldBoard = fullOldEntries.filter((entry) =>
    finalPoolTeamIds.has(entry.teamId),
  );
  const newcomers = entries
    .filter(
      (entry) =>
        finalPoolTeamIds.has(entry.teamId) && !oldTeamIds.has(entry.teamId),
    )
    .map(zeroedOutEntry);
  return [...fromOldBoard, ...newcomers];
}

/** Entries in their own (server-ranked) order, capped. */
function settledRows(
  entries: LeaderboardEntry[],
  maxRank: number | undefined,
): LeaderboardRow[] {
  return capToMaxRank(entries, maxRank).map((entry) => ({
    entry,
    rankIndex: entry.rank - 1,
    label: formatRankLabel(entry),
  }));
}

/**
 * The old pool in old order. The pool is a subset of the old board, so its
 * ranks are recomputed with the shared ranking rule rather than read off the
 * old entries. 'counting' swaps in each team's new entry so its total can
 * count up while the row stays put.
 */
function oldStateRows(
  entries: LeaderboardEntry[],
  fullOldEntries: LeaderboardEntry[],
  maxRank: number | undefined,
  phase: LeaderboardPhase,
): LeaderboardRow[] {
  const pool = rankTeams(oldPoolEntries(entries, fullOldEntries, maxRank));
  const entriesByTeamId = new Map(
    entries.map((entry) => [entry.teamId, entry]),
  );
  return pool.map((oldEntry) => ({
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
 * Keeps the bottom `revealCount` rank groups of an already-capped pool, so
 * the walk counts distinct ranks (a tie reveals in one step) and always
 * reaches rank 1 once it covers the pool. Omitted shows every row.
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
 * The rows the leaderboard shows, in order. The cap applies first, then the
 * reveal walk inside the capped pool. While the old board is animating
 * ('old'/'counting' with `previousEntries` given) the whole old pool shows:
 * it is already exactly the final pool, and its tie structure over old
 * scores can group differently from the final one, so the reveal walk isn't
 * a meaningful cut there.
 */
export function selectLeaderboardRows({
  entries,
  revealCount,
  maxRank,
  previousEntries,
  phase,
}: LeaderboardRowsInput): LeaderboardRow[] {
  const fullOldEntries = fullPreviousBoard(entries, previousEntries);
  if (phase !== 'settled' && fullOldEntries !== undefined) {
    return oldStateRows(entries, fullOldEntries, maxRank, phase);
  }
  return revealBottomUp(settledRows(entries, maxRank), revealCount);
}

export interface PreviousBoardCaptureInput {
  /** The board currently remembered as "the board before this update". */
  remembered: LeaderboardEntry[];
  /** The latest snapshot's game status. */
  status: GameStatus;
  /** Whether the latest snapshot shows the leaderboard. */
  isLeaderboardVisible: boolean;
  /** The latest snapshot's leaderboard, absent when the server sent none. */
  leaderboard: LeaderboardEntry[] | undefined;
}

/**
 * The board to remember as the previous board: the board the Kahoot
 * between-questions animation and the trend arrows compare against.
 *
 * Captures only while the question is still on air (question_open/locking)
 * and the leaderboard is hidden. A Kahoot question's points land at the
 * locking->reveal transition, before the between-questions board appears,
 * so capturing on 'reveal' would grab the already-updated totals and leave
 * nothing to animate. Returns `remembered` itself when nothing changes, so
 * the display page can call this during render without an extra render.
 */
export function capturePreviousBoard({
  remembered,
  status,
  isLeaderboardVisible,
  leaderboard,
}: PreviousBoardCaptureInput): LeaderboardEntry[] {
  const shouldCapture =
    isQuestionOnAirStatus(status) &&
    !isLeaderboardVisible &&
    leaderboard !== undefined;
  return shouldCapture ? leaderboard : remembered;
}
