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

/** One colour per step so the three places read apart at a glance. */
const BAR_COLOR_BY_RANK: Record<number, string> = {
  1: 'bg-magenta',
  2: 'bg-cyan',
  3: 'bg-green',
};
const FALLBACK_BAR_COLOR = 'bg-orange';

/** Left-to-right order of a classic podium: 2nd, 1st, 3rd. */
function podiumOrder(entries: readonly LeaderboardEntry[]): LeaderboardEntry[] {
  const [first, second, third] = entries;
  return [second, first, third].filter(
    (entry): entry is LeaderboardEntry => entry !== undefined,
  );
}

/** The entries standing on the podium: the top three places, at most three teams. */
export function podiumEntries(
  entries: readonly LeaderboardEntry[],
): LeaderboardEntry[] {
  return entries
    .filter((entry) => entry.rank <= PODIUM_SIZE)
    .slice(0, PODIUM_SIZE);
}

interface PodiumProps {
  entries: readonly LeaderboardEntry[];
  /** Teams already standing on the podium; the others leave their step empty. Omit to show all. */
  visibleTeamIds?: ReadonlySet<number>;
  /** Whether the steps rise one after another (the ended screen) or each appears on its own (a live reveal). */
  isStaggered?: boolean;
}

/** The top three teams (ties share a step) standing on a podium. Animates transform and opacity only. */
export function Podium({
  entries,
  visibleTeamIds,
  isStaggered = true,
}: PodiumProps) {
  const isReducedMotion = useReducedMotion();
  const topThree = podiumEntries(entries);
  return (
    <ol
      aria-label="Podium"
      className="flex items-end justify-center gap-6"
      data-testid="podium"
    >
      {podiumOrder(topThree).map((entry) => {
        if (visibleTeamIds && !visibleTeamIds.has(entry.teamId)) {
          return <li key={entry.teamId} aria-hidden="true" className="w-64" />;
        }
        return (
          <motion.li
            key={entry.teamId}
            initial={{ opacity: 0, y: isReducedMotion ? 0 : 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: isStaggered ? (4 - entry.rank) * 0.3 : 0,
            }}
            className="flex w-64 flex-col items-center gap-2"
          >
            <span className="font-display text-display-2xl">
              {entry.teamName}
            </span>
            <span className="text-display-xl font-extrabold text-foreground/70">
              {entry.totalPoints} pts
            </span>
            <div
              data-testid="podium-step"
              className={`flex w-full items-start justify-center rounded-t-lg pt-3 font-display text-display-2xl text-background ${
                BAR_COLOR_BY_RANK[entry.rank] ?? FALLBACK_BAR_COLOR
              } ${BAR_HEIGHT_BY_RANK[entry.rank] ?? FALLBACK_BAR_HEIGHT}`}
            >
              {formatRankLabel(entry)}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
