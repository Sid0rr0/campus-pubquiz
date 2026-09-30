import type { AnswersUpdatedPayload } from '@campus-pubquiz/types';

/** An answer counts as correct when its stored verdict says so — a speed-scaled kahoot answer or an admin-accepted synonym counts, a partial match doesn't. */
export function countCorrectAnswers(
  liveAnswers: AnswersUpdatedPayload,
): number {
  return liveAnswers.answers.filter((answer) => answer.verdict === 'correct')
    .length;
}
