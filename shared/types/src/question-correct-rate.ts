import type { Verdict } from './answer-kind';
import { QUESTION_KINDS } from './question-kind';
import type { QuestionType } from './question-types';

/**
 * How much of a question one answer counts toward its correct rate, read from
 * the verdict alone: `correct` in full, `partial` as its points' share of the
 * question's points (clamped to 0-1), anything else (incorrect, ungraded) none.
 */
export function answerCredit(
  answer: { verdict: Verdict | null; pointsAwarded: number },
  questionPoints: number,
): number {
  if (answer.verdict === 'correct') return 1;
  if (answer.verdict !== 'partial' || questionPoints <= 0) return 0;
  return Math.min(1, Math.max(0, answer.pointsAwarded / questionPoints));
}

/**
 * Whether a correct rate says anything about a question of this type. A
 * one-winner type (closest guess) has none, so it is left out of every
 * rate-based figure. Read from the question type registry.
 */
export function hasMeaningfulCorrectRate(type: QuestionType): boolean {
  return QUESTION_KINDS[type].hasCorrectRate;
}
