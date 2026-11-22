import type {
  DoubledRoundView,
  GameStatus,
  PlayersStatePayload,
} from '@campus-pubquiz/types';

/** The rounds the server says count double for this team, and whether the title card is one of them. */
export function jokerMarksOf(
  view: Pick<PlayersStatePayload, 'phoneScreen'>,
  doubledRounds: readonly DoubledRoundView[],
) {
  const doubledRoundNumbers = doubledRounds.map((round) => round.roundNumber);
  const { phoneScreen } = view;
  return {
    doubledRounds,
    doubledRoundNumbers,
    isJokerTitleCard:
      phoneScreen.kind === 'round_title' &&
      doubledRoundNumbers.includes(phoneScreen.roundNumber),
  };
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
