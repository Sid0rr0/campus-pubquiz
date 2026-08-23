import { motion } from 'motion/react';
import type { LeaderboardEntry } from '@campus-pubquiz/types';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  /**
   * How many teams, counting up from last place, are currently revealed.
   * Omit to show every team immediately with no reveal animation (e.g. the
   * admin's own always-visible preview).
   */
  revealCount?: number;
}

const RANK_ACCENT_CLASSES = ['text-magenta', 'text-cyan', 'text-green'];

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
    return 'flex items-center gap-4 rounded-xl border-[3px] border-magenta bg-white px-5 py-3 shadow-[0_3px_0_#ec008c]';
  }
  if (rankIndex < 3) {
    return 'flex items-center gap-4 rounded-xl border-2 border-dark-blue/25 bg-white px-5 py-2.5';
  }
  return 'flex items-center gap-4 rounded-xl border-2 border-dark-blue/15 bg-white/60 px-5 py-2.5 text-dark-blue/70';
}

export function Leaderboard({ entries, revealCount }: LeaderboardProps) {
  const visibleCount =
    revealCount === undefined
      ? entries.length
      : Math.min(Math.max(revealCount, 0), entries.length);
  // Reveals bottom-up: the visible slice always ends at last place and grows
  // upward toward rank 1 as visibleCount increases.
  const sliceStart = entries.length - visibleCount;
  const visibleEntries = entries.slice(sliceStart);
  const rankInfos = computeRankInfos(entries);

  return (
    <ol className="flex flex-col gap-2">
      {visibleEntries.map((entry, offset) => {
        const index = sliceStart + offset;
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
              className={`font-display w-16 shrink-0 text-2xl ${RANK_ACCENT_CLASSES[rankIndex] ?? 'text-dark-blue/50'}`}
            >
              {label}
            </span>
            <span
              className={`flex-1 font-bold ${rankIndex === 0 ? 'text-xl' : 'text-lg'}`}
            >
              {entry.teamName}
            </span>
            {entry.bonusPoints !== 0 && (
              <span
                aria-label={`${entry.bonusPoints} bonus points`}
                className={`rounded-full px-2 py-0.5 text-sm font-extrabold ${
                  entry.bonusPoints > 0
                    ? 'bg-cyan text-dark-blue'
                    : 'bg-magenta text-white'
                }`}
              >
                {entry.bonusPoints > 0 ? '+' : ''}
                {entry.bonusPoints}
              </span>
            )}
            <span className="font-display text-xl">{entry.totalPoints}</span>
          </motion.li>
        );
      })}
    </ol>
  );
}
