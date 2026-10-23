import { jokerRoundPoints, type GameStatus } from '@campus-pubquiz/types';

/**
 * The extra points a joker adds to one revealed answer ("+1" on a 1-point
 * answer), or null when the question is not in the joker round or earned
 * nothing to double.
 */
export function jokerExtraPoints(
  rawPoints: number | null,
  questionRoundNumber: number,
  jokerRoundNumber: number | null,
): number | null {
  if (rawPoints === null || rawPoints <= 0) return null;
  if (jokerRoundNumber !== questionRoundNumber) return null;
  return jokerRoundPoints(rawPoints) - rawPoints;
}

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
