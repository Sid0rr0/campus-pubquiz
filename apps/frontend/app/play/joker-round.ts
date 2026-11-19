import type {
  DoubledRoundView,
  GameStatus,
  PlayersStatePayload,
} from '@campus-pubquiz/types';
import type { OpenedQuestionEntry } from '@/app/play/opened-questions';

/** Whether the title card or the selected question is in a round the server says counts double for this team. */
export function jokerMarksOf(
  view: Pick<PlayersStatePayload, 'phoneScreen' | 'blockQuestions'>,
  doubledRounds: readonly DoubledRoundView[],
  selectedQuestionId: number | undefined,
) {
  const doubledRoundNumbers = doubledRounds.map((round) => round.roundNumber);
  const { phoneScreen } = view;
  const selectedRoundNumber = view.blockQuestions.find(
    (question) => question.id === selectedQuestionId,
  )?.roundNumber;
  return {
    doubledRounds,
    doubledRoundNumbers,
    isJokerTitleCard:
      phoneScreen.kind === 'round_title' &&
      doubledRoundNumbers.includes(phoneScreen.roundNumber),
    isJokerQuestion:
      selectedRoundNumber !== undefined &&
      doubledRoundNumbers.includes(selectedRoundNumber),
  };
}

/** The selected question's points, verdict and joker bonus, once graded (all null with no selection or no graded entry). */
export function selectedResultOf(
  openedQuestions: readonly OpenedQuestionEntry[],
  selectedQuestionId: number | undefined,
  jokerExtras: Readonly<Record<number, number>>,
) {
  const entry =
    selectedQuestionId === undefined
      ? undefined
      : openedQuestions.find(
          (candidate) => candidate.id === selectedQuestionId,
        );
  return {
    points: entry?.pointsAwarded ?? null,
    verdict: entry?.verdict ?? null,
    jokerExtra: entry ? (jokerExtras[entry.id] ?? null) : null,
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
