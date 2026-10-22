import type { GameStatus } from '@campus-pubquiz/types';

/**
 * Whether the team's joker round has been played: its block has been revealed
 * (so a question of it sits among the past revealed ones), or the quiz has
 * ended. The phone derives it from what the server already sends, so it needs
 * no event of its own.
 */
export function isJokerRoundPlayed(
  jokerRoundNumber: number,
  status: GameStatus,
  pastRevealedQuestions: readonly { roundNumber: number }[],
): boolean {
  return (
    status === 'ended' ||
    pastRevealedQuestions.some(
      (question) => question.roundNumber === jokerRoundNumber,
    )
  );
}
