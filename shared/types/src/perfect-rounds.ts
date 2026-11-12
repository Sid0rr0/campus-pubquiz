import type { Verdict } from './answer-kind';
import { hasMeaningfulCorrectRate } from './question-correct-rate';
import type { QuestionType } from './question-types';

/**
 * How many of the given rounds each team had a Perfect round in: a `correct`
 * verdict on every question of the round whose type has a meaningful correct
 * rate (closest guess is left out, as in the clean sweep). A round with no such
 * question is never perfect; a partial, incorrect or missing answer breaks it.
 * Teams with 0 are left out. Pure: reads verdicts from the fun fact data.
 */
export function countPerfectRounds(
  rounds: readonly {
    questions: readonly { id: number; type: QuestionType }[];
  }[],
  answers: readonly {
    questionId: number;
    teamId: number;
    verdict: Verdict | null;
  }[],
): Map<number, number> {
  const correct = answers.filter(({ verdict }) => verdict === 'correct');
  const correctKeys = new Set(
    correct.map(({ questionId, teamId }) => `${questionId}:${teamId}`),
  );
  const teamIds = new Set(correct.map(({ teamId }) => teamId));
  const counts = new Map<number, number>();
  for (const { questions } of rounds) {
    const ratedIds = questions
      .filter(({ type }) => hasMeaningfulCorrectRate(type))
      .map(({ id }) => id);
    if (ratedIds.length === 0) continue;
    for (const teamId of teamIds) {
      if (ratedIds.every((id) => correctKeys.has(`${id}:${teamId}`))) {
        counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
      }
    }
  }
  return counts;
}
