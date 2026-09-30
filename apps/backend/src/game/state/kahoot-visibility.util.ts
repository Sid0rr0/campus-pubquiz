import type { SessionState } from '@/game/state/session-state';

/**
 * A kahootMode question opens right after the previous one's reveal (see
 * advanceFromReveal) while the between-questions leaderboard is still up:
 * it is already the session's current question, but nobody has been shown
 * it yet. The single rule for "that question is hidden" — the answer gate
 * and the players view both read it, so they cannot disagree.
 */
export function isQuestionHiddenBehindKahootLeaderboard(
  session: SessionState,
): boolean {
  const { status, roundIndex, isLeaderboardVisible } = session.progress;
  const isQuestionOpenPhase =
    status === 'question_open' ||
    status === 'locking' ||
    status === 'round_intro';
  const isKahootRound =
    session.seededGame.rounds[roundIndex]?.kahootMode ?? false;
  return isQuestionOpenPhase && isKahootRound && isLeaderboardVisible;
}
