import { useEffect, useRef, useState } from 'react';
import { animate, motion } from 'motion/react';
import {
  KAHOOT_LEADERBOARD_TOP_N,
  type LeaderboardEntry,
} from '@campus-pubquiz/types';

/** `maxRank` for a Kahoot round — at most N teams are shown. Re-exported here (from shared/types) so existing imports of this constant from this module keep working. */
export { KAHOOT_LEADERBOARD_TOP_N };

interface LeaderboardProps {
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
   * 0-indexed round (progress.roundIndex) this leaderboard reflects. Drives
   * the per-team rank-trend icon as a last resort, comparing current
   * standings to standings with just this round's points backed out, when
   * neither `previousEntries` nor `trendBaseline` supplies a real prior
   * snapshot to compare against instead (see those below — for a Kahoot
   * round this approximation is normally superseded, since "this round"
   * can span several questions and back out far more than just the last
   * one). Omit entirely to hide trend icons (e.g. the admin's always-visible
   * preview, shown outside round context).
   */
  currentRoundIndex?: number;
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
  /**
   * Real prior standings to compare against for the trend icon, for a view
   * that shouldn't animate from them (unlike `previousEntries`) — the
   * round-end/quiz-end reveal for a Kahoot round, which keeps its normal
   * one-team-at-a-time suspense walk rather than the between-questions
   * view's animated hold-then-settle. Superseded by `previousEntries` when
   * that's also given; falls back to `currentRoundIndex`'s approximation
   * when neither is. Same `[]`-means-no-board-yet handling as
   * `previousEntries`.
   */
  trendBaseline?: LeaderboardEntry[];
}

type RankTrend = 'up' | 'down' | 'same';

const RANK_TREND_LABELS: Record<RankTrend, string> = {
  up: 'moved up',
  down: 'moved down',
  same: 'no change',
};

const RANK_TREND_GLYPHS: Record<RankTrend, string> = {
  up: '▲',
  down: '▼',
  same: '–',
};

const RANK_TREND_COLOR_CLASSES: Record<RankTrend, string> = {
  up: 'text-green',
  down: 'text-red-500',
  same: 'text-dark-blue/40',
};

function rankTrend(
  currentRankIndex: number,
  previousRankIndex: number,
): RankTrend {
  if (currentRankIndex < previousRankIndex) return 'up';
  if (currentRankIndex > previousRankIndex) return 'down';
  return 'same';
}

function RankTrendIcon({ trend }: { trend: RankTrend }) {
  return (
    <span
      aria-label={RANK_TREND_LABELS[trend]}
      className={`text-[calc(1.25rem*var(--display-text-scale,1))] ${RANK_TREND_COLOR_CLASSES[trend]}`}
    >
      {RANK_TREND_GLYPHS[trend]}
    </span>
  );
}

/** This team's cumulative total with just `roundIndex`'s points removed — the standing an "up/down since last round" comparison needs. */
function totalBeforeRound(entry: LeaderboardEntry, roundIndex: number): number {
  return entry.totalPoints - (entry.roundPoints[roundIndex]?.points ?? 0);
}

/**
 * Competition-style rank groups (1st, 2nd, 2nd, 4th — never 1st, 2nd, 2nd,
 * 3rd) over items already sorted by score descending: a tie group's rank
 * index is its first member's position, so a tie pushes the next distinct
 * group down by the tie's full size, not just one step.
 */
function tieGroups<T>(
  sortedDesc: T[],
  scoreOf: (item: T) => number,
): Array<{ start: number; end: number }> {
  const groups: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < sortedDesc.length) {
    let end = i;
    while (
      end + 1 < sortedDesc.length &&
      scoreOf(sortedDesc[end + 1]) === scoreOf(sortedDesc[i])
    ) {
      end++;
    }
    groups.push({ start: i, end });
    i = end + 1;
  }
  return groups;
}

/**
 * Competition rank (0-indexed) per team by a score selector, using the same
 * tie-grouping scheme as computeRankInfos for the current standings — so a
 * trend comparison between the two never mismatches over a tie.
 */
function rankIndexByScore(
  entries: LeaderboardEntry[],
  scoreOf: (entry: LeaderboardEntry) => number,
): Map<number, number> {
  const sortedDesc = [...entries].sort((a, b) => scoreOf(b) - scoreOf(a));
  const rankByTeamId = new Map<number, number>();
  for (const { start, end } of tieGroups(sortedDesc, scoreOf)) {
    for (let index = start; index <= end; index++) {
      rankByTeamId.set(sortedDesc[index].teamId, start);
    }
  }
  return rankByTeamId;
}

/**
 * True once at least two teams have pulled apart in score — false while
 * every team is still tied (e.g. everyone on 0 before the game's first
 * Kahoot question). A board with no established order yet has nothing for a
 * team to have fallen from, so every team shows as having moved up onto it
 * rather than some landing on a misleading dash/down arrow relative to a tie.
 */
function hasEstablishedOrder(entries: LeaderboardEntry[]): boolean {
  return new Set(entries.map((entry) => entry.totalPoints)).size > 1;
}

const RANK_ACCENT_CLASSES = ['text-magenta', 'text-cyan', 'text-green'];

/** Above this magnitude, bonus points render as a number + star instead of one star per point. */
const BONUS_STAR_THRESHOLD = 9;

function bonusStarLabel(magnitude: number): string {
  return magnitude > BONUS_STAR_THRESHOLD
    ? `${magnitude}★`
    : '★'.repeat(magnitude);
}

function BonusStars({
  magnitude,
  colorClass,
  bonusPoints,
}: {
  magnitude: number;
  colorClass: string;
  bonusPoints: number;
}) {
  if (magnitude === 0) {
    return null;
  }
  return (
    <span
      aria-label={`${bonusPoints} bonus points`}
      className={`text-[calc(1.125rem*var(--display-text-scale,1))] font-extrabold ${colorClass}`}
    >
      {bonusStarLabel(magnitude)}
    </span>
  );
}

/** Positive and negative bonus totals render as separate badges so a team with both shows both. */
function BonusIndicator({
  positiveBonusPoints,
  negativeBonusPoints,
}: {
  positiveBonusPoints: number;
  negativeBonusPoints: number;
}) {
  if (positiveBonusPoints === 0 && negativeBonusPoints === 0) {
    return null;
  }
  return (
    <span className="flex items-center gap-[calc(0.375rem*var(--display-text-scale,1))]">
      <BonusStars
        magnitude={positiveBonusPoints}
        colorClass="text-yellow"
        bonusPoints={positiveBonusPoints}
      />
      <BonusStars
        magnitude={Math.abs(negativeBonusPoints)}
        colorClass="text-magenta"
        bonusPoints={negativeBonusPoints}
      />
    </span>
  );
}

export interface RankInfo {
  /** 0-indexed position of this tie group's first entry — drives styling. */
  rankIndex: number;
  /** Display label: "1." for a clear rank, or "2.–4." for a 3-way tie spanning those places. */
  label: string;
}

/**
 * Groups consecutive entries (already sorted by totalPoints desc) that share
 * the same score into one tied rank, e.g. three teams tied for 2nd-4th all
 * get the label "2.–4." and the next team is ranked 5th, not 4th.
 */
export function computeRankInfos(entries: LeaderboardEntry[]): RankInfo[] {
  const infos: RankInfo[] = [];
  for (const { start, end } of tieGroups(
    entries,
    (entry) => entry.totalPoints,
  )) {
    const label = start === end ? `${start + 1}.` : `${start + 1}.–${end + 1}.`;
    for (let index = start; index <= end; index++) {
      infos.push({ rankIndex: start, label });
    }
  }
  return infos;
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
 * Full-roster old board used for *trend* comparisons: `previousEntries`
 * itself, or — when it was passed as `[]` (no leaderboard has ever been
 * computed yet, e.g. the game's first Kahoot question) — the whole current
 * roster zeroed out. Always the full roster, never capped to `maxRank`: a
 * team's trend arrow compares its rank among every team, not just the
 * on-screen top N.
 */
function fullOldEntriesForTrend(
  entries: LeaderboardEntry[],
  previousEntries: LeaderboardEntry[] | undefined,
): LeaderboardEntry[] | undefined {
  if (previousEntries === undefined) return undefined;
  if (previousEntries.length > 0 || entries.length === 0)
    return previousEntries;
  return entries.map(zeroedOutEntry);
}

/**
 * The exact teams that will end up on screen once the board settles — the
 * first `maxRank` of `entries` by final standing, a hard cap on team count
 * that splits a tie at the cutoff rather than growing the pool to fit it —
 * each paired with its value on `fullOldEntries` where one exists, or 0 for
 * a team with no prior record there (new to the board, or `fullOldEntries`
 * is the all-zero stand-in above). Deliberately capped by the *final*
 * standing, not by re-deriving a cap from `fullOldEntries`'s own ranking:
 * the old board can have no ties at all where the new one has a large tied
 * group (e.g. two teams pull ahead and everyone else collapses to 0 on this
 * question) — if the cap were computed from the old, untied ranks instead,
 * the pool that holds/counts up on screen could end up entirely different
 * teams than the ones the board actually settles into.
 */
function oldPoolEntries(
  entries: LeaderboardEntry[],
  fullOldEntries: LeaderboardEntry[],
  maxRank: number | undefined,
): LeaderboardEntry[] {
  const finalPoolTeamIds = new Set(
    (maxRank === undefined ? entries : entries.slice(0, maxRank)).map(
      (entry) => entry.teamId,
    ),
  );
  const oldByTeamId = new Map(
    fullOldEntries.map((entry) => [entry.teamId, entry]),
  );
  const fromOldBoard = fullOldEntries.filter((entry) =>
    finalPoolTeamIds.has(entry.teamId),
  );
  const newcomers = entries
    .filter(
      (entry) =>
        finalPoolTeamIds.has(entry.teamId) && !oldByTeamId.has(entry.teamId),
    )
    .map(zeroedOutEntry);
  return [...fromOldBoard, ...newcomers];
}

function rowClasses(rankIndex: number): string {
  if (rankIndex === 0) {
    return 'flex items-center gap-3 rounded-xl border-[3px] border-magenta bg-white px-3 py-2 shadow-[0_3px_0_#ec008c]';
  }
  if (rankIndex < 3) {
    return 'flex items-center gap-3 rounded-xl border-2 border-dark-blue/25 bg-white px-3 py-1';
  }
  return 'flex items-center gap-3 rounded-xl border-2 border-dark-blue/15 bg-white/60 px-3 py-1 text-dark-blue/70';
}

/** How long the old standings hold on screen, unanimated, before scores start counting up. */
const OLD_STATE_HOLD_MS = 900;
/** How long score counting up takes, and how long the old row order is kept before rows reorder into the new standings. */
const SCORE_COUNT_UP_MS = 900;

/** The three-beat sequence `previousEntries` drives: hold the old board, count scores up in place, then reorder rows. Skips straight to 'settled' when there's no old state to animate from. */
type TransitionPhase = 'old' | 'counting' | 'settled';

/** A point total that counts up from its previous value instead of snapping, whenever `value` changes after mount. */
function AnimatedTotal({
  value,
  className,
}: {
  value: number;
  className: string;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValueRef = useRef(value);

  useEffect(() => {
    const from = previousValueRef.current;
    previousValueRef.current = value;
    if (from === value) return undefined;
    const controls = animate(from, value, {
      duration: SCORE_COUNT_UP_MS / 1000,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplayValue(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value]);

  return <span className={className}>{displayValue}</span>;
}

interface LeaderboardRow {
  entry: LeaderboardEntry;
  rankIndex: number;
  label: string;
}

/**
 * Chunks rows (already grouped by rankIndex via computeRankInfos, so equal
 * ranks are always contiguous) into one array per distinct rank — a tie
 * becomes a single multi-row group instead of several one-row ones.
 */
function groupByRank(rows: LeaderboardRow[]): LeaderboardRow[][] {
  const groups: LeaderboardRow[][] = [];
  for (const row of rows) {
    const currentGroup = groups.at(-1);
    if (currentGroup && currentGroup[0].rankIndex === row.rankIndex) {
      currentGroup.push(row);
    } else {
      groups.push([row]);
    }
  }
  return groups;
}

export function Leaderboard({
  entries,
  revealCount,
  maxRank,
  currentRoundIndex,
  previousEntries,
  trendBaseline,
}: LeaderboardProps) {
  const hasOldState = previousEntries !== undefined;
  const [phase, setPhase] = useState<TransitionPhase>(
    hasOldState ? 'old' : 'settled',
  );

  useEffect(() => {
    if (!hasOldState) return undefined;
    const toCounting = setTimeout(
      () => setPhase('counting'),
      OLD_STATE_HOLD_MS,
    );
    const toSettled = setTimeout(
      () => setPhase('settled'),
      OLD_STATE_HOLD_MS + SCORE_COUNT_UP_MS,
    );
    return () => {
      clearTimeout(toCounting);
      clearTimeout(toSettled);
    };
    // Deliberately only depends on hasOldState, not entries/previousEntries:
    // this sequence should play once per mount (a fresh leaderboard screen),
    // not restart on every snapshot broadcast while it's on screen.
  }, [hasOldState]);

  const newRankInfos = computeRankInfos(entries);
  const fullOldEntries = fullOldEntriesForTrend(entries, previousEntries);
  // maxRank narrows the pool first — the reveal walk then counts up from the
  // worst-ranked team *within that pool* toward rank 1, so a capped Kahoot
  // leaderboard (top 5 of, say, a 7-team game) actually reaches rank 1 once
  // the walk finishes. Filtering after slicing instead (as this used to)
  // spends revealCount's whole budget walking up from the true last place,
  // so a revealCount capped at 5 for 7 teams would slice out ranks 3-7 and
  // then filter that down to just ranks 3-5 — ranks 1 and 2 never appear.
  //
  // maxRank is a hard cap on team count: the first `maxRank` entries by
  // final standing, splitting a tie at the cutoff rather than growing the
  // pool to fit it whole — the display never shows more than `maxRank` rows.
  //
  // Rows for 'old'/'counting': the pool is capped by *final* standing
  // (oldPoolEntries), then held at each team's old value — only 'counting'
  // swaps in the new total (looked up by id) so the number can count up
  // while its row stays put. Capping by final standing rather than
  // re-deriving a cap from the old board's own ranking matters whenever the
  // old board had no ties where the new one does (see oldPoolEntries' docs)
  // — using the old ranking here could hold/count up an entirely different
  // set of teams than the one the board actually settles into. Rows for
  // 'settled' (or when there's no old state at all): entries in their own
  // current order, capped and ranked fresh.
  const isAnimatingOldState =
    phase !== 'settled' && fullOldEntries !== undefined;
  let cappedRows: LeaderboardRow[];
  if (!isAnimatingOldState) {
    const freshRows = entries.map((entry, index) => ({
      entry,
      ...newRankInfos[index],
    }));
    cappedRows =
      maxRank === undefined ? freshRows : freshRows.slice(0, maxRank);
  } else {
    const pool = oldPoolEntries(entries, fullOldEntries, maxRank).sort(
      (a, b) => b.totalPoints - a.totalPoints,
    );
    const oldRankInfos = computeRankInfos(pool);
    const entriesByTeamId = new Map(
      entries.map((entry) => [entry.teamId, entry]),
    );
    cappedRows = pool.map((oldEntry, index) => ({
      entry:
        phase === 'counting'
          ? (entriesByTeamId.get(oldEntry.teamId) ?? oldEntry)
          : oldEntry,
      ...oldRankInfos[index],
    }));
  }
  // revealCount is a raw team count too, but counted in terms of *distinct
  // ranks* within the already-capped pool — a tie counts once no matter how
  // many teams share it. Walking rank groups instead of raw rows keeps that
  // consistent: a tie that survives the maxRank cut still reveals as one
  // step, not one click per tied team.
  const rankGroups = groupByRank(cappedRows);
  // While holding/counting the old board, oldPoolEntries has already picked
  // exactly the final pool that belongs on screen — that set doesn't grow
  // incrementally in this phase (the Kahoot leaderboard this animation is
  // for always reveals its whole capped pool at once — see
  // computeLeaderboardRevealCount's isKahootRound branch), and its own tie
  // structure over *old* scores can group very differently from the final
  // one (see oldPoolEntries' docs), so revealCount's bottom-up walk isn't a
  // meaningful cut here — only a real, settled reveal walk (which never has
  // an old state to animate from) uses it.
  const visibleGroupCount =
    isAnimatingOldState || revealCount === undefined
      ? rankGroups.length
      : Math.min(Math.max(revealCount, 0), rankGroups.length);
  // Reveals bottom-up: the visible slice always ends at last place (within
  // the capped pool) and grows upward toward rank 1 as visibleGroupCount
  // grows, one whole rank group at a time.
  const groupSliceStart = rankGroups.length - visibleGroupCount;
  // The board exactly as it stood before this update — from previousEntries
  // when it's driving the animation, or trendBaseline otherwise — is the
  // more accurate trend basis whenever one is available (a Kahoot round can
  // hold several questions, so backing this round's points out of the
  // current total would net out earlier questions in the same round too,
  // not just this one). Falls back to the round-backed-out approximation
  // only when neither is given (the non-Kahoot round-end/quiz-end reveal,
  // which has no old snapshot to compare against).
  const trendOldEntries =
    fullOldEntries ?? fullOldEntriesForTrend(entries, trendBaseline);
  const previousRankByTeamId =
    trendOldEntries !== undefined
      ? rankIndexByScore(trendOldEntries, (entry) => entry.totalPoints)
      : currentRoundIndex === undefined
        ? undefined
        : rankIndexByScore(entries, (entry) =>
            totalBeforeRound(entry, currentRoundIndex),
          );
  // Once teams have actually pulled apart, a shared start (everyone tied,
  // usually at 0) can't tell a team that took the lead from one that merely
  // held its ground — comparing ranks against that tie would wrongly hand
  // out a dash to the new leader and a down arrow to everyone else. Forcing
  // "up" for the whole board sidesteps that until a real order exists to
  // compare against.
  const forceUpTrend =
    trendOldEntries !== undefined &&
    trendOldEntries.length > 1 &&
    !hasEstablishedOrder(trendOldEntries);
  const visibleRows = rankGroups.slice(groupSliceStart).flat();

  return (
    <ol className="flex flex-col gap-2">
      {visibleRows.map(({ entry, rankIndex, label }) => {
        // Only compares against the pre-round trend once standings have
        // settled into their final order — during 'old'/'counting' the row
        // is still sitting at its old rank, which would compare against the
        // wrong basis and show a misleading arrow.
        const previousRankIndex =
          phase === 'settled'
            ? previousRankByTeamId?.get(entry.teamId)
            : undefined;
        const totalPointsClassName =
          'font-display text-[calc(2rem*var(--display-text-scale,1))]';
        return (
          <motion.li
            key={entry.teamId}
            layout
            initial={revealCount === undefined ? false : { opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={rowClasses(rankIndex)}
          >
            {previousRankIndex !== undefined && (
              <RankTrendIcon
                trend={
                  forceUpTrend ? 'up' : rankTrend(rankIndex, previousRankIndex)
                }
              />
            )}
            <span
              className={`font-display w-[2.5em] shrink-0 whitespace-nowrap text-[calc(2rem*var(--display-text-scale,1))] ${RANK_ACCENT_CLASSES[rankIndex] ?? 'text-dark-blue/50'}`}
            >
              {label}
            </span>
            <span
              className={`flex-1 font-bold ${rankIndex === 0 ? 'text-[calc(2rem*var(--display-text-scale,1))]' : 'text-[calc(1.75rem*var(--display-text-scale,1))]'}`}
            >
              {entry.teamName}
            </span>
            <BonusIndicator
              positiveBonusPoints={entry.positiveBonusPoints}
              negativeBonusPoints={entry.negativeBonusPoints}
            />
            {hasOldState ? (
              <AnimatedTotal
                value={entry.totalPoints}
                className={totalPointsClassName}
              />
            ) : (
              <span className={totalPointsClassName}>{entry.totalPoints}</span>
            )}
          </motion.li>
        );
      })}
    </ol>
  );
}
