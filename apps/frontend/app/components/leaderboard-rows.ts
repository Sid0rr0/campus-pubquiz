import { rankTeams, type LeaderboardEntry } from '@campus-pubquiz/types';
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
  /**
   * Real prior standings to compare against for the trend, for a view that
   * shouldn't animate from them (unlike `previousEntries`) — the
   * round-end/quiz-end reveal for a Kahoot round, which keeps its normal
   * one-team-at-a-time suspense walk rather than the between-questions
   * view's animated hold-then-settle. Superseded by `previousEntries` when
   * that's also given; falls back to `currentRoundIndex`'s approximation
   * when neither is. Same `[]`-means-no-board-yet handling as
   * `previousEntries`.
   */
  trendBaseline?: LeaderboardEntry[];
  /**
   * 0-indexed round (progress.roundIndex) this leaderboard reflects. Drives
   * the per-team trend as a last resort, comparing current standings to
   * standings with just this round's points backed out, when neither
   * `previousEntries` nor `trendBaseline` supplies a real prior snapshot to
   * compare against instead (for a Kahoot round this approximation is
   * normally superseded, since "this round" can span several questions and
   * back out far more than just the last one). Omit entirely to give no
   * trend (e.g. the admin's always-visible preview, shown outside round
   * context).
   */
  currentRoundIndex?: number;
}

/** How a team's rank moved against the trend basis. */
export type RankTrend = 'up' | 'down' | 'same';

export interface LeaderboardRow {
  /** The entry to draw: the old one in 'old', the new one in 'counting' and 'settled'. */
  entry: LeaderboardEntry;
  /**
   * 0-based rank, relative to the full standings (or, while animating, among
   * the final teams on their old totals).
   */
  rankIndex: number;
  /** "2." for a clear place, "2.–4." for a tie group. */
  label: string;
  /** Rank movement against the trend basis; only in 'settled', and only with a basis. */
  trend?: RankTrend;
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
function fullPreviousBoard(
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
function finalTeamsOnOldTotals(
  entries: LeaderboardEntry[],
  fullOldEntries: LeaderboardEntry[],
  maxRank: number | undefined,
): LeaderboardEntry[] {
  const finalTeamIds = new Set(
    capToMaxRank(entries, maxRank).map((entry) => entry.teamId),
  );
  const oldTeamIds = new Set(fullOldEntries.map((entry) => entry.teamId));
  const fromOldBoard = fullOldEntries.filter((entry) =>
    finalTeamIds.has(entry.teamId),
  );
  const newcomers = entries
    .filter(
      (entry) =>
        finalTeamIds.has(entry.teamId) && !oldTeamIds.has(entry.teamId),
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
 * The final teams on their old totals, in old order. They are a subset of
 * the old board, so their ranks are recomputed with the shared ranking rule
 * rather than read off the old entries. 'counting' swaps in each team's new entry so its total can
 * count up while the row stays put.
 */
function oldStateRows(
  entries: LeaderboardEntry[],
  fullOldEntries: LeaderboardEntry[],
  maxRank: number | undefined,
  phase: LeaderboardPhase,
): LeaderboardRow[] {
  const oldRanking = rankTeams(
    finalTeamsOnOldTotals(entries, fullOldEntries, maxRank),
  );
  const entriesByTeamId = new Map(
    entries.map((entry) => [entry.teamId, entry]),
  );
  return oldRanking.map((oldEntry) => ({
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
 * Keeps the bottom `revealCount` rank groups of already-capped rows, so the
 * walk counts distinct ranks (a tie reveals in one step) and always reaches
 * rank 1 once it covers every group. Omitted shows every row.
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
 * reveal walk inside the capped rows. While the old board is animating
 * ('old'/'counting' with `previousEntries` given) every final team shows on
 * its old total: they are already exactly the teams the board settles into,
 * and their tie structure over old scores can group differently from the
 * final one, so the reveal walk isn't a meaningful cut there.
 */
export function selectLeaderboardRows(
  input: LeaderboardRowsInput,
): LeaderboardRow[] {
  const { entries, revealCount, maxRank, previousEntries, phase } = input;
  const fullOldEntries = fullPreviousBoard(entries, previousEntries);
  if (phase !== 'settled' && fullOldEntries !== undefined) {
    return oldStateRows(entries, fullOldEntries, maxRank, phase);
  }
  return withTrends(
    revealBottomUp(settledRows(entries, maxRank), revealCount),
    input,
    fullOldEntries,
  );
}

/** This team's cumulative total with just `roundIndex`'s points removed — the standing an "up/down since last round" comparison needs. */
function totalBeforeRound(entry: LeaderboardEntry, roundIndex: number): number {
  return entry.totalPoints - (entry.roundPoints[roundIndex]?.points ?? 0);
}

/**
 * Competition rank (0-indexed) per team on a board, from the shared ranking
 * rule — the same one the server ranks live standings with — so a trend
 * comparison against a previous board never mismatches over a tie.
 */
function rankIndexByTeamId(entries: LeaderboardEntry[]): Map<number, number> {
  return new Map(
    rankTeams(entries).map((team) => [team.teamId, team.rank - 1]),
  );
}

/** The board a trend compares against, and whether it is a real prior board. */
interface TrendBasis {
  board: LeaderboardEntry[];
  /** False for the round-backed-out approximation. */
  isPriorBoard: boolean;
}

/**
 * The board to compare against for the trend. The board exactly as it stood
 * before this update — from `previousEntries` when it's driving the
 * animation (already resolved by the caller as `fullOldEntries`), or
 * `trendBaseline` otherwise — is the more accurate basis whenever one is
 * available (a Kahoot round can hold several questions, so backing this
 * round's points out of the current total would net out earlier questions
 * in the same round too, not just this one). Falls back to the
 * round-backed-out approximation only when neither is given (the non-Kahoot
 * round-end/quiz-end reveal); none when that's missing too.
 */
function trendBasis(
  { entries, trendBaseline, currentRoundIndex }: LeaderboardRowsInput,
  fullOldEntries: LeaderboardEntry[] | undefined,
): TrendBasis | undefined {
  const priorBoard =
    fullOldEntries ?? fullPreviousBoard(entries, trendBaseline);
  if (priorBoard !== undefined) {
    return { board: priorBoard, isPriorBoard: true };
  }
  if (currentRoundIndex === undefined) return undefined;
  const board = entries.map((entry) => ({
    ...entry,
    totalPoints: totalBeforeRound(entry, currentRoundIndex),
  }));
  return { board, isPriorBoard: false };
}

/**
 * True while a real prior board (more than one team) has every team still
 * tied, e.g. everyone on 0 before the game's first Kahoot question. Comparing
 * ranks against that tie would hand a dash to the new leader and a down
 * arrow to everyone else, so every team shows as having moved up onto the
 * board instead. The round-backed-out approximation never forces "up".
 */
function isAllTiedPriorBoard({ board, isPriorBoard }: TrendBasis): boolean {
  return (
    isPriorBoard &&
    board.length > 1 &&
    new Set(board.map((entry) => entry.totalPoints)).size === 1
  );
}

function rankTrend(
  currentRankIndex: number,
  previousRankIndex: number,
): RankTrend {
  if (currentRankIndex < previousRankIndex) return 'up';
  if (currentRankIndex > previousRankIndex) return 'down';
  return 'same';
}

/**
 * Rows with their trend against the trend basis, where one exists — only in
 * 'settled', since before then a row's rank isn't the one it will settle on.
 */
function withTrends(
  rows: LeaderboardRow[],
  input: LeaderboardRowsInput,
  fullOldEntries: LeaderboardEntry[] | undefined,
): LeaderboardRow[] {
  if (input.phase !== 'settled') return rows;
  const basis = trendBasis(input, fullOldEntries);
  if (basis === undefined) return rows;
  const isForcedUp = isAllTiedPriorBoard(basis);
  const previousRankByTeamId = rankIndexByTeamId(basis.board);
  return rows.map((row) => {
    const previousRankIndex = previousRankByTeamId.get(row.entry.teamId);
    if (previousRankIndex === undefined) return row;
    const trend = isForcedUp
      ? 'up'
      : rankTrend(row.rankIndex, previousRankIndex);
    return { ...row, trend };
  });
}
