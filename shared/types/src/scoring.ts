import type { QuestionType } from './question-types';
import type { MatchScoringMode } from './socket-events';
import { splitPipeList } from './sort-match';

/**
 * The Scoring module: every question type's scoring rule, pure (no I/O) so
 * the backend, quiz editor and control panel read one source. Callers pass a
 * whole question rather than type/answer/points/mode separately, so a new
 * scoring option only touches this file and the question's own schema.
 */

export type Verdict = 'correct' | 'partial' | 'incorrect';

/** The slice of a question scoring needs — RevealQuestionView satisfies it. */
export interface ScoredQuestion {
  type: QuestionType;
  answer: string;
  points: number;
  /** Match only: undefined behaves as 'partial'. */
  matchScoringMode?: MatchScoringMode;
}

export interface ScoreResult {
  points: number;
  verdict: Verdict;
}

/** Kahoot speed inputs: how long the team took and the configured timer. Either null means no scaling. */
export interface SpeedContext {
  responseMs: number | null;
  timerMs: number | null;
}

/** Graded the instant they're submitted. */
export const AUTO_GRADED_TYPES: readonly QuestionType[] = [
  'multiple_choice',
  'sort',
  'match',
  'free_text',
];

/** Graded in one pass once the question locks, comparing every guess. */
export const BATCH_GRADED_TYPES: readonly QuestionType[] = ['closest_guess'];

/** Need the quiz master's judgement. */
export const HUMAN_GRADED_TYPES: readonly QuestionType[] = ['audio', 'youtube'];

/**
 * The only types a kahoot round accepts. Deliberately its own list rather
 * than derived from AUTO_GRADED_TYPES: free_text grades at submit but would
 * turn the speed race into typing speed and spelling (see ADR 0001).
 */
export const KAHOOT_ALLOWED_TYPES: readonly QuestionType[] = [
  'multiple_choice',
  'sort',
  'match',
];

/** Types the admin can regrade per answer — closest_guess is recomputed as a batch. */
export const OVERRIDABLE_TYPES: readonly QuestionType[] = [
  ...AUTO_GRADED_TYPES,
  ...HUMAN_GRADED_TYPES,
];

export function isAutoGradedType(type: QuestionType): boolean {
  return AUTO_GRADED_TYPES.includes(type);
}

export function isKahootAllowedType(type: QuestionType): boolean {
  return KAHOOT_ALLOWED_TYPES.includes(type);
}

export function isOverridableType(type: QuestionType): boolean {
  return OVERRIDABLE_TYPES.includes(type);
}

/** Half of `points`, rounded — match all_or_nothing's one-wrong-pair credit. */
export function halfPoints(points: number): number {
  return Math.round(points / 2);
}

const INCORRECT: ScoreResult = { points: 0, verdict: 'incorrect' };

function normalizeFreeText(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * `value` and `question.answer` are pipe-joined right-hand items in the
 * question's `options` (left-hand) order, so comparing them positionally
 * counts correctly matched pairs.
 */
function scoreMatch(question: ScoredQuestion, value: string): ScoreResult {
  const answerPairs = splitPipeList(question.answer);
  const submittedPairs = splitPipeList(value);
  const correctPairCount = answerPairs.filter(
    (rightItem, index) => rightItem === submittedPairs[index],
  ).length;
  const wrongPairCount = answerPairs.length - correctPairCount;
  if (wrongPairCount === 0) {
    return { points: question.points, verdict: 'correct' };
  }
  if (question.matchScoringMode === 'all_or_nothing') {
    return wrongPairCount === 1
      ? { points: halfPoints(question.points), verdict: 'partial' }
      : INCORRECT;
  }
  return {
    points: Math.round(
      (question.points * correctPairCount) / answerPairs.length,
    ),
    verdict: correctPairCount === 0 ? 'incorrect' : 'partial',
  };
}

function scoreBase(question: ScoredQuestion, value: string): ScoreResult {
  const correct: ScoreResult = { points: question.points, verdict: 'correct' };
  switch (question.type) {
    case 'match':
      return scoreMatch(question, value);
    case 'free_text':
      return normalizeFreeText(value) === normalizeFreeText(question.answer)
        ? correct
        : INCORRECT;
    case 'sort':
      // Same tolerance as match: stray whitespace and empty items don't cost
      // a team the question.
      return splitPipeList(value).join('|') ===
        splitPipeList(question.answer).join('|')
        ? correct
        : INCORRECT;
    case 'multiple_choice':
      return value === question.answer ? correct : INCORRECT;
    default:
      return INCORRECT;
  }
}

/** Kahoot's `1 - fraction/2`: full points answered instantly, a 50% floor at or past the timer, 1 when speed can't be judged. */
export function speedMultiplier(speed: SpeedContext): number {
  if (speed.responseMs === null || speed.timerMs === null) return 1;
  const fraction = Math.min(Math.max(speed.responseMs / speed.timerMs, 0), 1);
  return 1 - fraction / 2;
}

/** Scores one submission. Speed scales points only — it never changes the verdict. */
export function scoreSubmission(
  question: ScoredQuestion,
  value: string,
  speed?: SpeedContext,
): ScoreResult {
  const base = scoreBase(question, value);
  if (speed === undefined) return base;
  return {
    points: Math.round(base.points * speedMultiplier(speed)),
    verdict: base.verdict,
  };
}

/** The verdict for points the admin typed in: full (or more) is correct, zero (or less) incorrect, anything between partial. */
export function verdictForManualGrade(
  question: Pick<ScoredQuestion, 'points'>,
  points: number,
): Verdict {
  if (points <= 0) return 'incorrect';
  return points >= question.points ? 'correct' : 'partial';
}

/**
 * Grades every closest_guess submission together: all teams tied for the
 * smallest distance get full points, everyone else zero. Non-numeric guesses
 * are infinitely far and never win. Results line up with `values`.
 */
export function gradeClosestGuessBatch(
  question: ScoredQuestion,
  values: readonly string[],
): ScoreResult[] {
  const target = Number(question.answer);
  const distances = values.map((value) => {
    const guess = Number(value);
    return Number.isFinite(guess) ? Math.abs(guess - target) : Infinity;
  });
  const closest = Math.min(...distances);
  return distances.map((distance) =>
    Number.isFinite(distance) && distance === closest
      ? { points: question.points, verdict: 'correct' }
      : INCORRECT,
  );
}
