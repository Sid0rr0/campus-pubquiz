import { QUESTION_KINDS, type QuestionKind } from './question-kind';
import {
  ANSWER_FORMATS,
  matchesKey,
  resolveAnswerKind,
  type ScoreResult,
  type Verdict,
} from './answer-kind';
import { QUESTION_TYPES, type QuestionType } from './question-types';
import type { MatchScoringMode } from './question-views';
import { halfPoints, nearestHalfPoint } from './score-math';

export { halfPoints, nearestHalfPoint };
export type { ScoreResult, Verdict };

/**
 * The Scoring module: every question type's scoring rule, pure (no I/O) so
 * the backend, quiz editor and control panel read one source. Callers pass a
 * whole question rather than type/answer/points/mode separately, so a new
 * scoring option only touches this file and the question's own schema.
 */

/** The slice of a question scoring needs — RevealQuestionView satisfies it. */
export interface ScoredQuestion {
  type: QuestionType;
  answer: string;
  points: number;
  /** Match only: undefined behaves as 'partial'. */
  matchScoringMode?: MatchScoringMode;
}

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

/** Graded the instant they're submitted. */
export const AUTO_GRADED_TYPES = typesWhere(
  (kind) => kind.gradingMode === 'auto',
);

/** Graded in one pass once the question locks, comparing every guess. */
export const BATCH_GRADED_TYPES = typesWhere(
  (kind) => kind.gradingMode === 'batch',
);

/** Graded correct at submit when they match the key; any other answer needs the quiz master's judgement. */
export const MATCH_OR_HUMAN_TYPES = typesWhere(
  (kind) => kind.gradingMode === 'match-or-human',
);

/**
 * The only types a kahoot round accepts. Its own entry field rather than
 * derived from the grading mode: free_text grades at submit but would turn
 * the speed race into typing speed and spelling (see ADR 0001).
 */
export const KAHOOT_ALLOWED_TYPES = typesWhere((kind) => kind.kahootAllowed);

/** Types the admin can regrade per answer — closest_guess is recomputed as a batch. */
export const OVERRIDABLE_TYPES = typesWhere((kind) => kind.overridable);

export function isAutoGradedType(type: QuestionType): boolean {
  return AUTO_GRADED_TYPES.includes(type);
}

export function isMatchOrHumanType(type: QuestionType): boolean {
  return QUESTION_KINDS[type].gradingMode === 'match-or-human';
}

export function isBatchGradedType(type: QuestionType): boolean {
  return QUESTION_KINDS[type].gradingMode === 'batch';
}

export function isKahootAllowedType(type: QuestionType): boolean {
  return KAHOOT_ALLOWED_TYPES.includes(type);
}

export function isOverridableType(type: QuestionType): boolean {
  return OVERRIDABLE_TYPES.includes(type);
}

const INCORRECT: ScoreResult = { points: 0, verdict: 'incorrect' };

/**
 * The base score comes from the answer format of the question's answer kind.
 * A kind with no per-answer score (the number kind: closest_guess is graded
 * in one batch) scores nothing here. Resolved from the type alone, so an
 * audio/youtube question with choices is still compared as typed text.
 */
function scoreBase(question: ScoredQuestion, value: string): ScoreResult {
  const { score } = ANSWER_FORMATS[resolveAnswerKind(question)];
  return score === null ? INCORRECT : score(question, value);
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

/**
 * The grade a submission gets the moment it lands, or null when it gets none
 * and waits for the quiz master: every submission to an auto type is graded,
 * a match-or-human type only when it matches the key, and a batch type never.
 */
export function gradeAtSubmit(
  question: ScoredQuestion,
  value: string,
): ScoreResult | null {
  const { gradingMode } = QUESTION_KINDS[question.type];
  if (gradingMode === 'auto') return scoreSubmission(question, value);
  if (gradingMode === 'match-or-human' && matchesKey(question, value)) {
    return scoreSubmission(question, value);
  }
  return null;
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
