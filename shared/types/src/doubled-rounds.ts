import type { TeamJoker } from './joker';
import type { PowerUpId } from './power-ups';
import { QUESTION_KINDS } from './question-kind';
import type { QuestionType } from './question-types';

/** Whether a round can be doubled, by a joker or an extra joker: never a round that has a Clue question. */
export function canBeDoubled(round: {
  questions: readonly { type: QuestionType }[];
}): boolean {
  return !round.questions.some(
    (question) => QUESTION_KINDS[question.type].hasClues,
  );
}

/** Whether a session plays with jokers: the Jokers setting is on and some round can be a joker round (with none, the joker pick is skipped). */
// shortcut: read from the quiz as it is now, not stored when the pick is skipped, so a live edit that makes an all-Clue quiz's round eligible lets Previous from round 0's intro open a pick late; store the decision if that ever happens on a real night.
export function playsJokers(seededGame: {
  settings: { jokersEnabled: boolean };
  rounds: readonly { questions: readonly { type: QuestionType }[] }[];
}): boolean {
  return (
    seededGame.settings.jokersEnabled && seededGame.rounds.some(canBeDoubled)
  );
}

/** A purchase, as far as doubling needs it: round power-ups carry a round id, question power-ups and blind purchases none. */
export interface DoublingPurchase {
  powerUp: PowerUpId;
  roundId: number | null;
}

/** The rounds a team doubles: its joker round and every round it bought an extra joker for, each once (no round counts more than double). */
export function doubledRoundIds(
  jokerRoundId: number | undefined,
  purchases: readonly DoublingPurchase[],
): number[] {
  const ids = purchases.flatMap((purchase) =>
    purchase.powerUp === 'extra_joker' && purchase.roundId !== null
      ? [purchase.roundId]
      : [],
  );
  return [
    ...new Set(jokerRoundId === undefined ? ids : [jokerRoundId, ...ids]),
  ];
}

/** `doubledRoundIds` for one team, from a session's jokers and its purchase list. */
export function doubledRoundIdsOfTeam(
  jokers: Readonly<Record<number, TeamJoker>>,
  purchases: readonly (DoublingPurchase & { teamId: number })[],
  teamId: number,
): number[] {
  return doubledRoundIds(
    jokers[teamId]?.roundId,
    purchases.filter((purchase) => purchase.teamId === teamId),
  );
}
