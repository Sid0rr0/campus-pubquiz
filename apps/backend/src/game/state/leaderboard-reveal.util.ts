import {
  KAHOOT_LEADERBOARD_TOP_N,
  type GameAction,
  type GameProgress,
  type LeaderboardEntry,
} from '@campus-pubquiz/types';

/**
 * Toggling the board resets the reveal to nothing shown; from then on,
 * ADVANCE and REVEAL_NEXT_TEAM both step the reveal forward one team at a
 * time (bottom-up) — whichever button the admin has on screen works.
 *
 * A kahootMode round's leaderboard only ever needs revealing up to its
 * top-5 cutoff (KAHOOT_LEADERBOARD_TOP_N, same one the display's maxRank
 * enforces) — beyond the 5th team there's nothing left to reveal, so the
 * one-by-one walk stops there instead of requiring a click per team.
 *
 * The one exception: the leaderboard shown *between* kahoot questions (the
 * next question already sits open underneath, hidden until dismissed — see
 * advanceFromReveal) reveals its top 5 fully at once instead of one at a
 * time — kahoot's pace-driven exception. The round-end and end-of-quiz
 * leaderboards (even for a kahoot round) keep the normal suspense-building
 * one-team-at-a-time reveal, just capped to the top 5 above.
 */
export function computeLeaderboardRevealCount(
  action: GameAction,
  wasLeaderboardVisible: boolean,
  newProgress: GameProgress,
  leaderboard: LeaderboardEntry[],
  currentRevealCount: number,
  isKahootRound: boolean,
): number {
  const revealTarget = isKahootRound
    ? Math.min(KAHOOT_LEADERBOARD_TOP_N, leaderboard.length)
    : leaderboard.length;
  if (
    isKahootRound &&
    newProgress.status === 'question_open' &&
    newProgress.isLeaderboardVisible
  ) {
    return revealTarget;
  }
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
    return Math.min(currentRevealCount + 1, revealTarget);
  }
  return currentRevealCount;
}
