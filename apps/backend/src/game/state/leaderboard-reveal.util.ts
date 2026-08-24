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
  wasLeaderboardVisible: boolean,
  newProgress: GameProgress,
  leaderboard: LeaderboardEntry[],
  currentRevealCount: number,
): number {
  if (action === 'TOGGLE_LEADERBOARD') {
    return 0;
  }
  // Any auto-triggered transition that newly shows the board — ending the
  // quiz, or finishing a mid-quiz reveal block — starts from empty, same as
  // an explicit TOGGLE_LEADERBOARD: it must never inherit a stale or partial
  // count left over from an earlier reveal.
  if (!wasLeaderboardVisible && newProgress.isLeaderboardVisible) {
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
