import { useEffect, useRef, useState } from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
} from 'motion/react';
import type { RankTrend } from '@campus-pubquiz/types';
import {
  selectLeaderboardRows,
  type LeaderboardPhase,
  type LeaderboardRow,
  type LeaderboardRowsInput,
} from '@/app/components/leaderboard-rows';
import {
  isTopThreeReveal,
  rankEntrance,
} from '@/app/components/leaderboard-entrance';
import { displaySounds } from '@/app/lib/display-sounds';
import { useOnLiveForwardMove } from '@/app/lib/live-change';

/**
 * Every prop means what {@link LeaderboardRowsInput} documents; the view
 * supplies the phase itself.
 */
type LeaderboardProps = Omit<LeaderboardRowsInput, 'phase'>;

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

export function Leaderboard({ board, revealCount }: LeaderboardProps) {
  const hasOldState = board.countUpBoard !== undefined;
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
    // Deliberately only depends on hasOldState, not the board's contents:
    // this sequence should play once per mount (a fresh leaderboard screen),
    // not restart on every snapshot broadcast while it's on screen.
  }, [hasOldState]);

  const visibleRows = selectLeaderboardRows({ board, revealCount, phase });
  const newestRankIndex = visibleRows[0]?.rankIndex;

  // Rank reveal stays one rank per Advance; the drumroll marks the three that
  // matter. A reload or reconnect remounts the board, so it stays silent.
  useOnLiveForwardMove(revealCount ?? 0, true, () => {
    if (isTopThreeReveal(visibleRows)) {
      displaySounds.play('drumroll');
    }
  });

  return (
    <ol className="flex flex-col gap-2">
      {visibleRows.map((row) => (
        <LeaderboardRowItem
          key={row.entry.teamId}
          row={row}
          isAnimatedIn={revealCount !== undefined}
          isNewest={row.rankIndex === newestRankIndex}
          hasOldState={hasOldState}
        />
      ))}
    </ol>
  );
}

interface LeaderboardRowItemProps {
  row: LeaderboardRow;
  /** Whether the row enters with an animation (the reveal walk) or just appears (the plain preview). */
  isAnimatedIn: boolean;
  /** Whether this row holds the most recently revealed rank. */
  isNewest: boolean;
  hasOldState: boolean;
}

/** One row. Its entrance runs once on mount and is cut straight to its end as soon as a newer rank is revealed, so an Advance never waits for it. */
function LeaderboardRowItem({
  row: { entry, rankIndex, label, trend },
  isAnimatedIn,
  isNewest,
  hasOldState,
}: LeaderboardRowItemProps) {
  const isReducedMotion = useReducedMotion() ?? false;
  const [entrance] = useState(() => rankEntrance(rankIndex, isReducedMotion));
  const opacity = useMotionValue(isAnimatedIn ? 0 : 1);
  const y = useMotionValue(isAnimatedIn ? entrance.offsetY : 0);
  const playbacksRef = useRef<AnimationPlaybackControls[]>([]);

  useEffect(() => {
    if (!isAnimatedIn) return undefined;
    const options = {
      duration: entrance.durationSeconds,
      ease: 'easeOut',
    } as const;
    const playbacks = [animate(opacity, 1, options), animate(y, 0, options)];
    playbacksRef.current = playbacks;
    return () => playbacks.forEach((playback) => playback.stop());
  }, [isAnimatedIn, entrance, opacity, y]);

  useEffect(() => {
    if (!isNewest) {
      playbacksRef.current.forEach((playback) => playback.complete());
    }
  }, [isNewest]);

  const totalPointsClassName = 'font-display text-display-3xl';
  return (
    <motion.li
      layout
      style={{ opacity, y }}
      className={`relative isolate ${rowClasses(rankIndex)}`}
    >
      {rankIndex === 0 && (
        <RankOneSpotlight
          delaySeconds={isAnimatedIn ? entrance.durationSeconds : 0}
        />
      )}
      {trend !== undefined && <RankTrendIcon trend={trend} />}
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
}

/** A glow behind the leader's row that fades in once the row has landed (opacity only, no animated shadow). */
function RankOneSpotlight({ delaySeconds }: { delaySeconds: number }) {
  return (
    <motion.span
      aria-hidden="true"
      data-testid="rank-one-spotlight"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: delaySeconds, duration: 0.6, ease: 'easeOut' }}
      className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-[radial-gradient(ellipse_at_center,rgba(255,214,0,0.55),transparent_70%)]"
    />
  );
}
