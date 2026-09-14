import { motion } from 'motion/react';
import type { LeaderboardEntry } from '@campus-pubquiz/types';

/** `maxRank` for a Kahoot round — only the top N distinct ranks are shown. */
export const KAHOOT_LEADERBOARD_TOP_N = 5;

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
  let i = 0;
  while (i < entries.length) {
    let end = i;
    while (
      end + 1 < entries.length &&
      entries[end + 1].totalPoints === entries[i].totalPoints
    ) {
      end++;
    }
    const label = i === end ? `${i + 1}.` : `${i + 1}.–${end + 1}.`;
    for (let index = i; index <= end; index++) {
      infos.push({ rankIndex: i, label });
    }
    i = end + 1;
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

export function Leaderboard({
  entries,
  revealCount,
  maxRank,
}: LeaderboardProps) {
  const visibleCount =
    revealCount === undefined
      ? entries.length
      : Math.min(Math.max(revealCount, 0), entries.length);
  // Reveals bottom-up: the visible slice always ends at last place and grows
  // upward toward rank 1 as visibleCount increases.
  const sliceStart = entries.length - visibleCount;
  const rankInfos = computeRankInfos(entries);
  const visibleEntries = entries
    .slice(sliceStart)
    .map((entry, offset) => ({ entry, index: sliceStart + offset }))
    .filter(
      ({ index }) =>
        maxRank === undefined || rankInfos[index].rankIndex < maxRank,
    );

  return (
    <ol className="flex flex-col gap-2">
      {visibleEntries.map(({ entry, index }) => {
        const { rankIndex, label } = rankInfos[index];
        return (
          <motion.li
            key={entry.teamId}
            layout
            initial={revealCount === undefined ? false : { opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={rowClasses(rankIndex)}
          >
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
            <span className="font-display text-[calc(2rem*var(--display-text-scale,1))]">
              {entry.totalPoints}
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}
