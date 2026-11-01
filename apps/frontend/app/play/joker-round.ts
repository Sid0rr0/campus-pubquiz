import {
  jokerRoundPoints,
  type GameStatus,
  type PurchaseView,
} from '@campus-pubquiz/types';

/** A round that counts double for this team, by number and title ("" when the team bought it blind). */
export interface DoubledRound {
  roundNumber: number;
  title: string;
}

/** The rounds doubled for this team, in quiz order: its joker round and those its extra jokers are on. */
export function doubledRoundsOf(
  jokerRound: DoubledRound | undefined,
  purchases: readonly PurchaseView[],
): DoubledRound[] {
  return [
    ...(jokerRound ? [jokerRound] : []),
    ...purchases.flatMap((purchase) => purchase.round ?? []),
  ].sort((a, b) => a.roundNumber - b.roundNumber);
}

/**
 * The extra points a joker adds to one revealed answer ("+1" on a 1-point
 * answer), or null when the question is not in a doubled round or earned
 * nothing to double.
 */
export function jokerExtraPoints(
  rawPoints: number | null,
  questionRoundNumber: number,
  doubledRoundNumbers: readonly number[],
): number | null {
  if (rawPoints === null || rawPoints <= 0) return null;
  if (!doubledRoundNumbers.includes(questionRoundNumber)) return null;
  return jokerRoundPoints(rawPoints) - rawPoints;
}

/**
 * Whether a doubled round has been played: its block has been revealed
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
