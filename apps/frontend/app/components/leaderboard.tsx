import { useEffect, useRef, useState } from 'react';
import { animate, motion } from 'motion/react';
import {
  KAHOOT_LEADERBOARD_TOP_N,
  type LeaderboardEntry,
} from '@campus-pubquiz/types';

/** `maxRank` for a Kahoot round — only the top N distinct ranks are shown. Re-exported here (from shared/types) so existing imports of this constant from this module keep working. */
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
   * Caps how many distinct ranks are shown (e.g. KAHOOT_LEADERBOARD_TOP_N
   * for a Kahoot round) — rankIndex groups tied teams, so a tie spanning the
   * cutoff either fully shows or fully hides together, never splits mid-tie.
   * Composed with revealCount when both are given: an entry renders only if
   * it satisfies both. Omit to show every team.
   */
  maxRank?: number;
  /**
   * 0-indexed round (progress.roundIndex) this leaderboard reflects. Drives
   * the per-team rank-trend icon comparing current standings to standings
   * with just this round's points backed out. Omit to hide trend icons
   * (e.g. the admin's always-visible preview, shown outside round context).
   */
  currentRoundIndex?: number;
  /**
   * Standings exactly as they were before `entries`' current point totals
   * were applied — e.g. the board right before a Kahoot question's results
   * landed. When given, the leaderboard opens on this old state, holds it,
   * counts each team's score up to its new total, then reorders rows into
   * their new standings, instead of rendering straight at the final state.
   * Omit for every other leaderboard view (the round-end/quiz-end reveal,
   * the admin's own preview), which should still render `entries` directly.
   */
  previousEntries?: LeaderboardEntry[];
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
    <span className="flex items-center gap-1.5">
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

interface RankInfo {
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
function computeRankInfos(entries: LeaderboardEntry[]): RankInfo[] {
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

function rowClasses(rankIndex: number): string {
  if (rankIndex === 0) {
    return 'flex items-center gap-4 rounded-xl border-[3px] border-magenta bg-white px-5 py-2 shadow-[0_3px_0_#ec008c]';
  }
  if (rankIndex < 3) {
    return 'flex items-center gap-4 rounded-xl border-2 border-dark-blue/25 bg-white px-5 py-1.5';
  }
  return 'flex items-center gap-4 rounded-xl border-2 border-dark-blue/15 bg-white/60 px-5 py-1.5 text-dark-blue/70';
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

export function Leaderboard({
  entries,
  revealCount,
  maxRank,
  currentRoundIndex,
  previousEntries,
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
  // Rows for 'old'/'counting': same teams, same order, and same rank labels
  // as the pre-update board — only 'counting' swaps in each team's new total
  // (looked up by id) so the number can count up while its row stays put.
  // Rows for 'settled' (or when there's no old state at all): entries in
  // their own current order, ranked fresh — today's behavior, unanimated.
  let rows: LeaderboardRow[];
  if (phase === 'settled' || previousEntries === undefined) {
    rows = entries.map((entry, index) => ({ entry, ...newRankInfos[index] }));
  } else {
    const entriesByTeamId = new Map(
      entries.map((entry) => [entry.teamId, entry]),
    );
    const oldRankInfos = computeRankInfos(previousEntries);
    rows = previousEntries.map((oldEntry, index) => ({
      entry:
        phase === 'counting'
          ? (entriesByTeamId.get(oldEntry.teamId) ?? oldEntry)
          : oldEntry,
      ...oldRankInfos[index],
    }));
  }

  // maxRank narrows the pool first — the reveal walk then counts up from the
  // worst-ranked team *within that pool* toward rank 1, so a capped Kahoot
  // leaderboard (top 5 of, say, a 7-team game) actually reaches rank 1 once
  // the walk finishes. Filtering after slicing instead (as this used to)
  // spends revealCount's whole budget walking up from the true last place,
  // so a revealCount capped at 5 for 7 teams would slice out ranks 3-7 and
  // then filter that down to just ranks 3-5 — ranks 1 and 2 never appear.
  const cappedRows =
    maxRank === undefined
      ? rows
      : rows.filter((row) => row.rankIndex < maxRank);
  const visibleCount =
    revealCount === undefined
      ? cappedRows.length
      : Math.min(Math.max(revealCount, 0), cappedRows.length);
  // Reveals bottom-up: the visible slice always ends at last place (within
  // the capped pool) and grows upward toward rank 1 as visibleCount grows.
  const sliceStart = cappedRows.length - visibleCount;
  const previousRankByTeamId =
    currentRoundIndex === undefined
      ? undefined
      : rankIndexByScore(entries, (entry) =>
          totalBeforeRound(entry, currentRoundIndex),
        );
  const visibleRows = cappedRows.slice(sliceStart);

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
              <RankTrendIcon trend={rankTrend(rankIndex, previousRankIndex)} />
            )}
            <span
              className={`font-display w-16 shrink-0 whitespace-nowrap text-[calc(2rem*var(--display-text-scale,1))] ${RANK_ACCENT_CLASSES[rankIndex] ?? 'text-dark-blue/50'}`}
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
