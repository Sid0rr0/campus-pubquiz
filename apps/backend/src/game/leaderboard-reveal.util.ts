import type {
  GameAction,
  GameProgress,
  LeaderboardEntry,
} from '@campus-pubquiz/types';

/**
 * Toggling the board resets the reveal to nothing shown; from then on,
 * ADVANCE and REVEAL_NEXT_TEAM both step the reveal forward one team at a
 * time (bottom-up) — whichever button the admin has on screen works.
 */
export function computeLeaderboardRevealCount(
  action: GameAction,
  newProgress: GameProgress,
  leaderboard: LeaderboardEntry[],
  currentRevealCount: number,
): number {
  if (action === 'TOGGLE_LEADERBOARD') {
    return 0;
  }
  // Entering the final leaderboard — whether via the last question's ADVANCE
  // or the admin's explicit End Quiz button — always starts from empty, same
  // as any other TOGGLE_LEADERBOARD: it must never inherit a stale or
  // partial count left over from an earlier mid-game reveal.
  if (
    newProgress.status === 'ended' &&
    (action === 'ADVANCE' || action === 'END_QUIZ')
  ) {
    return 0;
  }
  if (
    (action === 'ADVANCE' || action === 'REVEAL_NEXT_TEAM') &&
    newProgress.isLeaderboardVisible
  ) {
    return Math.min(currentRevealCount + 1, leaderboard.length);
  }
  return currentRevealCount;
}
