import type { LeaderboardRow } from '@/app/components/leaderboard-rows';
import { PODIUM_SIZE } from '@/app/lib/podium-size';

const REGULAR_DURATION_SECONDS = 0.5;
const TOP_THREE_DURATION_SECONDS = 1.1;
const REGULAR_OFFSET_Y = 32;
const TOP_THREE_OFFSET_Y = 72;

export interface RankEntrance {
  durationSeconds: number;
  /** How far below its place the row starts, in px; 0 for a plain crossfade. */
  offsetY: number;
}

/** How a revealed rank comes in: the top three slower and from further down, everything a crossfade under reduced motion. */
export function rankEntrance(
  rankIndex: number,
  isReducedMotion: boolean,
): RankEntrance {
  if (isReducedMotion) {
    return { durationSeconds: REGULAR_DURATION_SECONDS, offsetY: 0 };
  }
  return rankIndex < PODIUM_SIZE
    ? {
        durationSeconds: TOP_THREE_DURATION_SECONDS,
        offsetY: TOP_THREE_OFFSET_Y,
      }
    : {
        durationSeconds: REGULAR_DURATION_SECONDS,
        offsetY: REGULAR_OFFSET_Y,
      };
}

/**
 * Whether the rank the last Advance revealed is one of the top three. The
 * rows are revealed bottom-up, so the newest revealed rank is the first row.
 */
export function isTopThreeReveal(visibleRows: LeaderboardRow[]): boolean {
  const newest = visibleRows[0];
  return newest !== undefined && newest.rankIndex < PODIUM_SIZE;
}
