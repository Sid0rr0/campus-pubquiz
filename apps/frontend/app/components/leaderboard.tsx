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

function rowClasses(rank: number): string {
  if (rank === 0) {
    return 'flex items-center gap-4 rounded-xl border-[3px] border-magenta bg-white px-5 py-3 shadow-[0_3px_0_#ec008c]';
  }
  if (rank < 3) {
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
  const startRank = entries.length - visibleCount;
  const visibleEntries = entries.slice(startRank);

  return (
    <ol className="flex flex-col gap-2">
      {visibleEntries.map((entry, offset) => {
        const rank = startRank + offset;
        return (
          <motion.li
            key={entry.teamId}
            layout
            initial={revealCount === undefined ? false : { opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={rowClasses(rank)}
          >
            <span className={`font-display w-10 text-2xl ${RANK_ACCENT_CLASSES[rank] ?? 'text-dark-blue/50'}`}>
              {rank + 1}
            </span>
            <span className={`flex-1 font-bold ${rank === 0 ? 'text-xl' : 'text-lg'}`}>{entry.teamName}</span>
            <span className="font-display text-xl">{entry.totalPoints}</span>
          </motion.li>
        );
      })}
    </ol>
  );
}
