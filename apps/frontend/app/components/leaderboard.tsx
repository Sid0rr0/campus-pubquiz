import { useEffect, useRef, useState } from 'react';
import { animate, motion } from 'motion/react';
import {
  KAHOOT_LEADERBOARD_TOP_N,
  rankTeams,
  type LeaderboardEntry,
} from '@campus-pubquiz/types';
import {
  fullPreviousBoard,
  selectLeaderboardRows,
  type LeaderboardPhase,
  type LeaderboardRowsInput,
} from '@/app/components/leaderboard-rows';

/** `maxRank` for a Kahoot round — at most N teams are shown. Re-exported here (from shared/types) so existing imports of this constant from this module keep working. */
export { KAHOOT_LEADERBOARD_TOP_N };

/**
 * `entries`, `revealCount`, `maxRank` and `previousEntries` mean what
 * {@link LeaderboardRowsInput} documents; the view supplies the phase itself.
 */
interface LeaderboardProps extends Omit<LeaderboardRowsInput, 'phase'> {
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
      className={`text-display-xl ${RANK_TREND_COLOR_CLASSES[trend]} w-[1em] text-center`}
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
 * Competition rank (0-indexed) per team by a score selector, from the shared
 * ranking rule — the same one the server ranks live standings with — so a
 * trend comparison against a previous board never mismatches over a tie.
 */
function rankIndexByScore(
  entries: LeaderboardEntry[],
  scoreOf: (entry: LeaderboardEntry) => number,
): Map<number, number> {
  const ranked = rankTeams(
    entries.map((entry) => ({ ...entry, totalPoints: scoreOf(entry) })),
  );
  return new Map(ranked.map((team) => [team.teamId, team.rank - 1]));
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
      className={`text-display-2xl font-extrabold ${colorClass}`}
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

export function Leaderboard({
  entries,
  revealCount,
  maxRank,
  currentRoundIndex,
  previousEntries,
  trendBaseline,
}: LeaderboardProps) {
  const hasOldState = previousEntries !== undefined;
  const [phase, setPhase] = useState<LeaderboardPhase>(
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

  const visibleRows = selectLeaderboardRows({
    entries,
    revealCount,
    maxRank,
    previousEntries,
    phase,
  });
  // The board exactly as it stood before this update — from previousEntries
  // when it's driving the animation, or trendBaseline otherwise — is the
  // more accurate trend basis whenever one is available (a Kahoot round can
  // hold several questions, so backing this round's points out of the
  // current total would net out earlier questions in the same round too,
  // not just this one). Falls back to the round-backed-out approximation
  // only when neither is given (the non-Kahoot round-end/quiz-end reveal,
  // which has no old snapshot to compare against).
  const trendOldEntries =
    fullPreviousBoard(entries, previousEntries) ??
    fullPreviousBoard(entries, trendBaseline);
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
        const totalPointsClassName = 'font-display text-display-3xl';
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
              className={`font-display w-[4em] shrink-0 whitespace-nowrap text-display-3xl ${RANK_ACCENT_CLASSES[rankIndex] ?? 'text-dark-blue/50'}`}
            >
              {label}
            </span>
            <span className="flex-1 font-bold text-display-3xl">
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
