import {
  doubledRoundIds,
  jokerRoundPoints,
  type GameStatus,
  type PlayersStatePayload,
  type PurchaseView,
} from '@campus-pubquiz/types';
import type { OpenedQuestionEntry } from '@/app/play/opened-questions';

/** A round that counts double for this team, by number and title ("" when the team bought it blind). */
export interface DoubledRound {
  roundNumber: number;
  title: string;
}

/** The rounds doubled for this team, in quiz order: the module says which round ids, the joker round and the purchases name them. */
export function doubledRoundsOf(
  jokerRound: (DoubledRound & { roundId: number }) | undefined,
  purchases: readonly PurchaseView[],
): DoubledRound[] {
  const named = new Map<number, DoubledRound>();
  for (const purchase of purchases) {
    if (purchase.roundId !== null && purchase.round) {
      named.set(purchase.roundId, purchase.round);
    }
  }
  if (jokerRound) named.set(jokerRound.roundId, jokerRound);
  return doubledRoundIds(jokerRound?.roundId, purchases)
    .flatMap((id) => named.get(id) ?? [])
    .sort((a, b) => a.roundNumber - b.roundNumber);
}

/** The rounds this team's joker (and any extra joker) doubles, and whether the title card or the selected question is in one. */
export function jokerMarksOf(
  view: Pick<
    PlayersStatePayload,
    'jokerRounds' | 'phoneScreen' | 'blockQuestions'
  >,
  myJoker: { roundId: number } | null,
  purchases: readonly PurchaseView[],
  selectedQuestionId: number | undefined,
) {
  const jokerRound = view.jokerRounds.find(
    (round) => round.roundId === myJoker?.roundId,
  );
  const doubledRounds = doubledRoundsOf(jokerRound, purchases);
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
  doubledRoundNumbers: readonly number[],
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
    jokerExtra: entry
      ? jokerExtraPoints(
          entry.pointsAwarded,
          entry.roundNumber,
          doubledRoundNumbers,
        )
      : null,
  };
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
