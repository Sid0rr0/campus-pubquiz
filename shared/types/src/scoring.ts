import { resolvedAnswerKeyOf, type GradingSettingsSource } from './answer-key';
import { QUESTION_KINDS, type QuestionKind } from './question-kind';
import {
  ANSWER_FORMATS,
  resolveAnswerKind,
  type ScoreResult,
  type Verdict,
} from './answer-kind';
import { QUESTION_TYPES, type QuestionType } from './question-types';
import { halfPoints, nearestHalfPoint } from './score-math';

export { halfPoints, nearestHalfPoint };
export type { ScoreResult, Verdict };

/**
 * The Scoring module: every question type's scoring rule, pure (no I/O) so
 * the backend, quiz editor and control panel read one source. Callers pass a
 * whole question rather than type/answer/points/mode separately, so a new
 * scoring option only touches this file and the question's own schema.
 */

/** The slice of a question scoring needs — SeededQuestion satisfies it. Unset settings are filled in by the Answer key. */
export type ScoredQuestion = GradingSettingsSource & {
  answer: string;
  points: number;
};

/** Kahoot speed inputs: how long the team took and the configured timer. Either null means no scaling. */
export interface SpeedContext {
  responseMs: number | null;
  timerMs: number | null;
}

function typesWhere(
  matches: (kind: QuestionKind) => boolean,
): readonly QuestionType[] {
  return QUESTION_TYPES.filter((type) => matches(QUESTION_KINDS[type]));
}

/** Graded in one pass once the question locks, comparing every guess. */
export const BATCH_GRADED_TYPES = typesWhere(
  (kind) => kind.gradingMode === 'batch',
);

/**
 * The only types a kahoot round accepts. Its own entry field rather than
 * derived from the grading mode: free_text grades at submit but would turn
 * the speed race into typing speed and spelling (see ADR 0001).
 */
export const KAHOOT_ALLOWED_TYPES = typesWhere((kind) => kind.kahootAllowed);

/** Names as a sentence list: commas, and "and" before the last ("a, b and c"); one name alone, nothing for none. */
export function joinNames(names: readonly string[]): string {
  // Stryker disable next-line StringLiteral: equivalent, the separator never shows with at most one name
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The kahoot-accepted types as people read them: lowercased labels in type-picker order, commas and "and" before the last ("multiple choice, sort / order and number"). */
export function kahootTypeNames(): string {
  return joinNames(
    KAHOOT_ALLOWED_TYPES.map((type) =>
      QUESTION_KINDS[type].label.toLowerCase(),
    ),
  );
}

/** Whether the type carries a margin: how far an answer may be from the key and still be correct (Number only). */
export function hasMarginType(type: QuestionType): boolean {
  return QUESTION_KINDS[type].gradingSettings.includes('margin');
}

/** Whether the type's answer key is a number (derived from its answer kind): Number and Closest guess. */
export function hasNumericAnswerKey(type: QuestionType): boolean {
  return resolveAnswerKind({ type }) === 'number';
}

export function isKahootAllowedType(type: QuestionType): boolean {
  return KAHOOT_ALLOWED_TYPES.includes(type);
}

const INCORRECT: ScoreResult = { points: 0, verdict: 'incorrect' };

/**
 * The base score comes from the answer format of the question's answer kind.
 * Resolved from the type alone, so an audio/youtube question with choices is
 * still compared as typed text.
 */
function scoreBase(question: ScoredQuestion, value: string): ScoreResult {
  // closest_guess is read as a number but carries no margin, so a lone
  // submission is scored against the default one; the resolved key supplies it.
  return ANSWER_FORMATS[resolveAnswerKind(question)].score(
    resolvedAnswerKeyOf(question),
    value,
  );
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
    points: nearestHalfPoint(base.points * speedMultiplier(speed)),
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
 * Which of `values` are the closest guesses to the numeric `answer`: every
 * guess tied for the smallest distance. Non-numeric guesses are infinitely
 * far and never closest. Results line up with `values`.
 */
export function findClosestGuesses(
  answer: string,
  values: readonly string[],
): boolean[] {
  const target = Number(answer);
  const distances = values.map((value) => {
    const guess = Number(value);
    return Number.isFinite(guess) ? Math.abs(guess - target) : Infinity;
  });
  const closest = Math.min(...distances);
  return distances.map(
    (distance) => Number.isFinite(distance) && distance === closest,
  );
}

/**
 * Grades every closest_guess submission together: the closest guesses (see
 * findClosestGuesses) get full points, everyone else zero. Results line up
 * with `values`.
 */
export function gradeClosestGuessBatch(
  question: ScoredQuestion,
  values: readonly string[],
): ScoreResult[] {
  return findClosestGuesses(question.answer, values).map((isClosest) =>
    isClosest ? { points: question.points, verdict: 'correct' } : INCORRECT,
  );
}
