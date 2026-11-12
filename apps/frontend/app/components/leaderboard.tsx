import { useEffect, useRef, useState } from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
} from 'motion/react';
import { nearestHalfPoint, type RankTrend } from '@campus-pubquiz/types';
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
import { JokerStamp } from '@/app/components/joker-stamp';
import { Podium, podiumEntries } from '@/app/components/podium';
import { fireConfetti } from '@/app/lib/confetti';
import { displaySounds } from '@/app/lib/display-sounds';
import { useOnLiveForwardMove } from '@/app/lib/live-change';

/**
 * Every prop means what {@link LeaderboardRowsInput} documents; the view
 * supplies the phase itself.
 */
type LeaderboardProps = Omit<LeaderboardRowsInput, 'phase'> & {
  /** Whether the client's connection is live; the drumroll stays silent otherwise. */
  isConnected: boolean;
  /** The last leaderboard of the quiz: the top three stand on a podium and the winner is celebrated. */
  isFinal?: boolean;
  /** Called once the winner's fanfare and confetti have gone off, so the Quiz complete screen can skip its own. */
  onWinnerCelebrated?: () => void;
  /** Versus: teamId -> the colour of the team's side, drawn as a dot on its row. */
  sideColors?: Record<number, string>;
};

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
  // A half point has no star to repeat, so it reads as a number too.
  return magnitude > BONUS_STAR_THRESHOLD || !Number.isInteger(magnitude)
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
      onUpdate: (latest) => setDisplayValue(nearestHalfPoint(latest)),
    });
    return () => controls.stop();
  }, [value]);

  return <span className={className}>{displayValue}</span>;
}

/** How long the "+x" stays after the row has settled, before it fades. */
const GAIN_LINGER_MS = 2000;

/** The floating "+x" / "−x" just outside a row's right border; fades GAIN_LINGER_MS after `settleDelayMs`. */
function PointsGained({
  gained,
  settleDelayMs,
}: {
  gained: number;
  settleDelayMs: number;
}) {
  const [isFaded, setIsFaded] = useState(false);
  useEffect(() => {
    const timer = setTimeout(
      () => setIsFaded(true),
      settleDelayMs + GAIN_LINGER_MS,
    );
    return () => clearTimeout(timer);
  }, [settleDelayMs]);
  const isGain = gained > 0;
  return (
    <span
      aria-label={
        isGain ? `gained ${gained} points` : `lost ${Math.abs(gained)} points`
      }
      className={`absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap font-display text-display-2xl transition-opacity duration-700 ${isGain ? 'text-green' : 'text-red-500'} ${isFaded ? 'opacity-0' : 'opacity-100'}`}
    >
      {isGain ? '+' : '−'}
      {Math.abs(gained)}
    </span>
  );
}

export function Leaderboard({
  board,
  revealCount,
  isConnected,
  isFinal = false,
  onWinnerCelebrated,
  sideColors,
}: LeaderboardProps) {
  const hasOldState = board.countUpBoard !== undefined;
  const phase = useLeaderboardPhase(hasOldState);

  const visibleRows = selectLeaderboardRows({ board, revealCount, phase });
  const newestRankIndex = visibleRows[0]?.rankIndex;
  // Stamps already there on first draw (a reload, a reconnect) are not slammed
  // down again; only one that appears after the board is on screen lands.
  const [alreadyStampedTeamIds] = useState(
    () =>
      new Set(
        visibleRows
          .filter((row) => row.isJokerStamped)
          .map((row) => row.entry.teamId),
      ),
  );

  useRankRevealSounds({
    revealCount,
    isConnected,
    isFinal,
    visibleRows,
    onWinnerCelebrated,
  });

  const isPodiumMode = isFinal && phase === 'settled';
  const { listRows, standingTeamIds } = splitPodium(
    board,
    visibleRows,
    isPodiumMode,
  );

  return (
    <div className="flex flex-col gap-6">
      {standingTeamIds.size > 0 && (
        <Podium
          entries={board.entries}
          visibleTeamIds={standingTeamIds}
          isStaggered={false}
        />
      )}
      <ol className="flex flex-col gap-2" data-testid="leaderboard-rows">
        {listRows.map((row) => (
          <LeaderboardRowItem
            key={row.entry.teamId}
            row={row}
            isAnimatedIn={revealCount !== undefined}
            isNewest={row.rankIndex === newestRankIndex}
            hasOldState={hasOldState}
            pointsGained={
              // Quickfire: the "+x" waits for the counting phase.
              hasOldState && phase === 'old'
                ? undefined
                : board.pointsGained?.[row.entry.teamId]
            }
            isStampLanding={!alreadyStampedTeamIds.has(row.entry.teamId)}
            sideColor={sideColors?.[row.entry.teamId]}
          />
        ))}
      </ol>
    </div>
  );
}

interface LeaderboardRowItemProps {
  row: LeaderboardRow;
  /** Whether the row enters with an animation (the reveal walk) or just appears (the plain preview). */
  isAnimatedIn: boolean;
  /** Whether this row holds the most recently revealed rank. */
  isNewest: boolean;
  hasOldState: boolean;
  /** What the team gained in the block, when the board shows one: a pub quiz row counts up from `total − gained`, and the "+x" floats beside it. */
  pointsGained?: number;
  /** Whether the row's joker stamp, if it has one, slams down rather than just being there. */
  isStampLanding: boolean;
  /** The colour of the team's Versus side, when it has one. */
  sideColor?: string;
}

/**
 * A pub quiz row's total counting up from `total − gained` on mount (nothing to
 * count without `gained`). Fixed on mount, so a live grade while the board is up
 * does not replay it; cut to its end as soon as a newer rank is revealed.
 */
function useRowCountUp(
  total: number,
  gained: number | undefined,
  isNewest: boolean,
) {
  const [from] = useState(() =>
    gained === undefined ? undefined : total - gained,
  );
  const [counted, setCounted] = useState(from);
  const controlsRef = useRef<AnimationPlaybackControls | undefined>(undefined);

  useEffect(() => {
    if (from === undefined) return undefined;
    const controls = animate(from, total, {
      duration: SCORE_COUNT_UP_MS / 1000,
      ease: 'easeOut',
      onUpdate: (latest) => setCounted(nearestHalfPoint(latest)),
      onComplete: () => setCounted(undefined),
    });
    controlsRef.current = controls;
    return () => controls.stop();
    // Once per mount: see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from]);

  // Latched while rendering (not in an effect), so the cut shows at once.
  const [isCut, setIsCut] = useState(false);
  if (!isNewest && !isCut) setIsCut(true);

  useEffect(() => {
    if (isCut) controlsRef.current?.stop();
  }, [isCut]);

  return {
    shownTotal: isCut ? total : (counted ?? total),
    isCountingUp: from !== undefined,
  };
}

/** A row's entrance: runs once on mount and is cut straight to its end as soon as a newer rank is revealed, so an Advance never waits for it. */
function useRowEntrance(
  rankIndex: number,
  isAnimatedIn: boolean,
  isNewest: boolean,
  isReducedMotion: boolean,
) {
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

  return { opacity, y };
}

/** One row of the board. */
function LeaderboardRowItem({
  row: { entry, rankIndex, label, trend, isJokerStamped },
  isAnimatedIn,
  isNewest,
  hasOldState,
  pointsGained,
  isStampLanding,
  sideColor,
}: LeaderboardRowItemProps) {
  const isReducedMotion = useReducedMotion() ?? false;
  const { opacity, y } = useRowEntrance(
    rankIndex,
    isAnimatedIn,
    isNewest,
    isReducedMotion,
  );
  const { shownTotal, isCountingUp } = useRowCountUp(
    entry.totalPoints,
    !hasOldState && !isReducedMotion ? pointsGained : undefined,
    isNewest,
  );
  const totalPointsClassName = 'font-display text-display-3xl';
  return (
    <motion.li
      layout
      style={{ opacity, y }}
      className={`relative isolate ${rowClasses(rankIndex)}`}
    >
      {trend !== undefined && <RankTrendIcon trend={trend} />}
      <span
        className={`font-display w-[4em] shrink-0 whitespace-nowrap text-display-3xl ${rankAccentClass(rankIndex)}`}
      >
        {label}
      </span>
      <SideDot color={sideColor} />
      <span className="flex-1 font-bold text-display-3xl">
        {entry.teamName}
      </span>
      {isJokerStamped && <JokerStamp isLanding={isStampLanding} />}
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
        <span className={totalPointsClassName}>{shownTotal}</span>
      )}
      {pointsGained !== undefined && (
        <PointsGained
          gained={pointsGained}
          settleDelayMs={isCountingUp ? SCORE_COUNT_UP_MS : 0}
        />
      )}
    </motion.li>
  );
}

/** The colour dot of a team's Versus side; nothing for a team without one. */
function SideDot({ color }: { color?: string }) {
  if (!color) return null;
  return (
    <span
      data-testid="side-dot"
      className="size-5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

/** Plays the old standings, the count-up, then settles — once per mount (a fresh leaderboard screen). */
function useLeaderboardPhase(hasOldState: boolean): LeaderboardPhase {
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
  return phase;
}

/** Rank reveal stays one rank per Advance; the drumroll marks the three that matter, the winner gets the fanfare. */
function useRankRevealSounds({
  revealCount,
  isConnected,
  isFinal,
  visibleRows,
  onWinnerCelebrated,
}: Pick<
  LeaderboardProps,
  'revealCount' | 'isConnected' | 'isFinal' | 'onWinnerCelebrated'
> & { visibleRows: ReturnType<typeof selectLeaderboardRows> }) {
  // Rank reveal stays one rank per Advance; the drumroll marks the three that
  // matter. A reload or reconnect remounts the board, so it stays silent.
  useOnLiveForwardMove(revealCount ?? 0, isConnected, () => {
    if (isFinal && visibleRows[0]?.rankIndex === 0) {
      // The winner appears with its own fanfare, so no drumroll over it.
      displaySounds.play('fanfare');
      fireConfetti();
      onWinnerCelebrated?.();
      return;
    }
    if (isTopThreeReveal(visibleRows)) {
      displaySounds.play('drumroll');
    }
  });
}

/** On the final board's podium the top three stand on the podium, not in the list; only those already revealed stand. */
function splitPodium(
  board: LeaderboardProps['board'],
  visibleRows: ReturnType<typeof selectLeaderboardRows>,
  isPodiumMode: boolean,
) {
  if (!isPodiumMode) {
    return { listRows: visibleRows, standingTeamIds: new Set<number>() };
  }
  const podiumTeamIds = new Set(
    podiumEntries(board.entries).map((entry) => entry.teamId),
  );
  return {
    listRows: visibleRows.filter((row) => !podiumTeamIds.has(row.entry.teamId)),
    standingTeamIds: new Set(
      visibleRows
        .filter((row) => podiumTeamIds.has(row.entry.teamId))
        .map((row) => row.entry.teamId),
    ),
  };
}

function rankAccentClass(rankIndex: number): string {
  return RANK_ACCENT_CLASSES[rankIndex] ?? 'text-dark-blue/50';
}
