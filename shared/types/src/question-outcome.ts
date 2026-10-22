import type { Verdict } from './answer-kind';
import {
  answerCredit,
  hasMeaningfulCorrectRate,
} from './question-correct-rate';
import type { QuestionType } from './question-types';

export interface QuestionOutcome {
  /** All given answers, ungraded ones included. */
  answeredCount: number;
  /** Answers whose verdict is `correct`. */
  correctCount: number;
  /** Answers whose verdict is `partial`. */
  partialCount: number;
  /**
   * Summed answer credit over the team count; null when the question type has
   * no correct rate or the team count is 0 or less.
   */
  correctRate: number | null;
}

/**
 * How one question went. Pure: the caller passes only that question's answers
 * and chooses the team count (the live views pass the roster, the stats page
 * every team that took part). Never filters answers or decides which teams count.
 */
export function questionOutcome(
  question: { type: QuestionType; points: number },
  answers: readonly { verdict: Verdict | null; pointsAwarded: number }[],
  teamCount: number,
): QuestionOutcome {
  let correctCount = 0;
  let partialCount = 0;
  let credit = 0;
  for (const answer of answers) {
    if (answer.verdict === 'correct') correctCount += 1;
    if (answer.verdict === 'partial') partialCount += 1;
    credit += answerCredit(answer, question.points);
  }
  return {
    answeredCount: answers.length,
    correctCount,
    partialCount,
    correctRate:
      hasMeaningfulCorrectRate(question.type) && teamCount > 0
        ? credit / teamCount
        : null,
  };
}
