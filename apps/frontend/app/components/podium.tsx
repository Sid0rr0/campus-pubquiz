import { motion, useReducedMotion } from 'motion/react';
import type { LeaderboardEntry } from '@campus-pubquiz/types';
import { PODIUM_SIZE } from '@/app/lib/podium-size';
import { formatRankLabel } from '@/app/lib/rank-label';

/** Bar height per competition rank, so the winner stands tallest. */
const BAR_HEIGHT_BY_RANK: Record<number, string> = {
  1: 'h-56',
  2: 'h-40',
  3: 'h-28',
};
const FALLBACK_BAR_HEIGHT = 'h-28';

/** Left-to-right order of a classic podium: 2nd, 1st, 3rd. */
function podiumOrder(entries: readonly LeaderboardEntry[]): LeaderboardEntry[] {
  const [first, second, third] = entries;
  return [second, first, third].filter(
    (entry): entry is LeaderboardEntry => entry !== undefined,
  );
}

/** The top three teams (ties share a step) standing on a podium. Animates transform and opacity only. */
export function Podium({ entries }: { entries: readonly LeaderboardEntry[] }) {
  const isReducedMotion = useReducedMotion();
  const topThree = entries
    .filter((entry) => entry.rank <= PODIUM_SIZE)
    .slice(0, PODIUM_SIZE);
  return (
    <ol
      aria-label="Podium"
      className="flex items-end justify-center gap-6"
      data-testid="podium"
    >
      {podiumOrder(topThree).map((entry) => (
        <motion.li
          key={entry.teamId}
          initial={{ opacity: 0, y: isReducedMotion ? 0 : 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: (4 - entry.rank) * 0.3 }}
          className="flex w-64 flex-col items-center gap-2"
        >
          <span className="font-display text-display-2xl">
            {entry.teamName}
          </span>
          <span className="text-display-xl font-extrabold text-foreground/70">
            {entry.totalPoints} pts
          </span>
          <div
            className={`flex w-full items-start justify-center rounded-t-lg bg-magenta pt-3 font-display text-display-2xl text-background ${
              BAR_HEIGHT_BY_RANK[entry.rank] ?? FALLBACK_BAR_HEIGHT
            }`}
          >
            {formatRankLabel(entry)}
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
