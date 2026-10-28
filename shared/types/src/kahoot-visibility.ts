import { isAnsweringStatus } from './game-state-groups';
import type { GameProgress } from './game-state-types';
import type { SeededRound, SessionState } from './session-state';

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

/** The id of the question `progress` stands on when its round is kahootMode; undefined for any other round, or a position past the round. */
export function currentKahootQuestionId(
  rounds: readonly SeededRound[],
  progress: GameProgress,
): number | undefined {
  const round = rounds[progress.roundIndex];
  return round?.kahootMode
    ? round.questions[progress.questionIndex]?.id
    : undefined;
}

/**
 * Whether the question the session stands on is a kahootMode question whose
 * reveal already aired. Its answer was on the big screen, so Previous
 * stepping back onto its locking countdown must not take answers again.
 */
export function isCurrentKahootQuestionRevealed(
  session: SessionState,
): boolean {
  const questionId = currentKahootQuestionId(
    session.seededGame.rounds,
    session.progress,
  );
  return (
    questionId !== undefined &&
    session.revealedKahootQuestionIds.includes(questionId)
  );
}
