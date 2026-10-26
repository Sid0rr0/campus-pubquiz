import { isAnsweringStatus } from './game-state-groups';
import type { SessionState } from './session-state';

/** Whether the round at `progress.roundIndex` has kahootMode set. */
export function isCurrentRoundKahoot(session: SessionState): boolean {
  return (
    session.seededGame.rounds[session.progress.roundIndex]?.kahootMode ?? false
  );
}

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
  const { status, isLeaderboardVisible } = session.progress;
  return (
    isAnsweringStatus(status) &&
    isCurrentRoundKahoot(session) &&
    isLeaderboardVisible
  );
}

/**
 * Whether the question the session stands on is a kahootMode question whose
 * reveal already aired. Its answer was on the big screen, so Previous
 * stepping back onto its locking countdown must not take answers again.
 */
export function isCurrentKahootQuestionRevealed(
  session: SessionState,
): boolean {
  const { roundIndex, questionIndex } = session.progress;
  const round = session.seededGame.rounds[roundIndex];
  const questionId = round?.questions[questionIndex]?.id;
  return (
    isCurrentRoundKahoot(session) &&
    questionId !== undefined &&
    session.revealedKahootQuestionIds.includes(questionId)
  );
}
