import type { AnswersUpdatedPayload } from '@campus-pubquiz/types';

/** An answer counts as correct once it's graded for the question's full points — partial credit doesn't count. */
export function countCorrectAnswers(
  liveAnswers: AnswersUpdatedPayload,
): number {
  return liveAnswers.answers.filter(
    (answer) => answer.pointsAwarded === liveAnswers.question.points,
  ).length;
}
