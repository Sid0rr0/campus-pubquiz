import {
  gradeAtSubmit,
  gradeClosestGuessBatch,
  QUESTION_KINDS,
  scoreSubmission,
  type GradingMode,
  type ScoredQuestion,
  type ScoreResult,
} from '@campus-pubquiz/types';

/**
 * The Grading policy: what each grading mode does on each grading event.
 * Pure: no Nest, no database. Scoring decides what a score is; this module
 * decides when and whether one is written. Every table is a
 * `Record<GradingMode, …>`, so a new grading mode fails typecheck until each
 * event has an answer for it.
 */

/** What the policy asks the persistence adapter to do to an answer's grade. */
export type GradeWrite =
  | { kind: 'set'; points: number; verdict: ScoreResult['verdict'] }
  | { kind: 'clear' }
  | { kind: 'keep' };

const KEEP: GradeWrite = { kind: 'keep' };
const CLEAR: GradeWrite = { kind: 'clear' };

/** The part of a team's stored answer the submit event reasons about. */
export interface StoredAnswerGrade {
  value: string;
  gradedAt: Date | null;
}

type SubmitRule = (
  score: ScoreResult | null,
  value: string,
  stored: StoredAnswerGrade | null,
) => GradeWrite;

function setOf(score: ScoreResult): GradeWrite {
  return { kind: 'set', points: score.points, verdict: score.verdict };
}

/** A revision (a changed value) with no automatic score drops the grade given to the old value; otherwise nothing changes. */
function clearsRevision(
  value: string,
  stored: StoredAnswerGrade | null,
): GradeWrite {
  return stored !== null && stored.value !== value ? CLEAR : KEEP;
}

const SUBMIT: Record<GradingMode, SubmitRule> = {
  // Every submission is scored, so a hand override is replaced on resubmit.
  auto: (score, value, stored) =>
    score ? setOf(score) : clearsRevision(value, stored),
  // A same-value resubmit of a graded answer keeps the moderator's grade.
  'match-or-human': (score, value, stored) => {
    const isSameValue = stored !== null && stored.value === value;
    if (isSameValue && stored.gradedAt !== null) return KEEP;
    return score ? setOf(score) : clearsRevision(value, stored);
  },
  // Never graded at submit: only a revision clears.
  batch: (score, value, stored) =>
    score ? setOf(score) : clearsRevision(value, stored),
};

/** The grade write for a team submitting `value`, given the answer it already stored (if any). */
export function gradeOnSubmit(
  question: ScoredQuestion,
  value: string,
  stored: StoredAnswerGrade | null,
): GradeWrite {
  const { gradingMode } = QUESTION_KINDS[question.type];
  return SUBMIT[gradingMode](gradeAtSubmit(question, value), value, stored);
}

const CAN_GRADE_BY_HAND: Record<
  GradingMode,
  (stored: { gradedAt: Date | null }) => boolean
> = {
  auto: () => true,
  'match-or-human': () => true,
  // Before its batch ran nobody knows who's closest, and the batch would
  // overwrite the grade anyway. This refusal is also what lets the batch read
  // "any row graded" as "the batch ran".
  batch: (stored) => stored.gradedAt !== null,
};

/** A stored answer as the key-fix event reads it. */
export interface StoredAnswerRow extends StoredAnswerGrade {
  responseMs: number | null;
  verdict: ScoreResult['verdict'] | null;
  pointsAwarded: number;
}

export interface KeyFixInput {
  question: ScoredQuestion;
  /** The question as it stood before the fix; the key the stored grades were judged against. */
  previous: ScoredQuestion;
  rows: readonly StoredAnswerRow[];
  /** The session's kahoot question timer for a kahootMode question, else null. */
  kahootTimerSeconds: number | null;
  /** Whether a batch question's batch already ran (the session holds its summary). */
  hasBatchRun: boolean;
}

export interface KeyFixResult {
  /** Whether the question was rescored at all; false leaves the grades untouched. */
  rescored: boolean;
  /** One write per input row, in order (empty when nothing was rescored). */
  writes: GradeWrite[];
}

/**
 * Whether a stored grade is what the submit-time grade gives against `key`:
 * the only way to tell an automatic grade from the moderator's. A moderator
 * grade identical to the automatic one counts as automatic (accepted tradeoff).
 */
function isGradedAutomatically(
  key: ScoredQuestion,
  stored: StoredAnswerRow,
): boolean {
  const score = gradeAtSubmit(key, stored.value);
  return (
    score !== null &&
    stored.gradedAt !== null &&
    stored.verdict === score.verdict &&
    stored.pointsAwarded === score.points
  );
}

/** Rescores every row speed-scaled by its stored response time when a timer is given. The auto key-fix and kahoot speed scoring share it. */
export function rescoreAuto(
  question: ScoredQuestion,
  rows: readonly StoredAnswerRow[],
  kahootTimerSeconds: number | null,
): GradeWrite[] {
  const timerMs =
    kahootTimerSeconds === null ? null : kahootTimerSeconds * 1000;
  return rows.map((row) =>
    setOf(
      scoreSubmission(
        question,
        row.value,
        timerMs === null ? undefined : { responseMs: row.responseMs, timerMs },
      ),
    ),
  );
}

const KEY_FIX: Record<GradingMode, (input: KeyFixInput) => KeyFixResult> = {
  auto: ({ question, rows, kahootTimerSeconds }) => ({
    rescored: true,
    writes: rescoreAuto(question, rows, kahootTimerSeconds),
  }),
  // A new match grades correct; a grade the old key gave automatically and
  // the new one no longer gives goes back to ungraded; the rest is the
  // moderator's.
  'match-or-human': ({ question, previous, rows }) => ({
    rescored: true,
    writes: rows.map((row) => {
      const score = gradeAtSubmit(question, row.value);
      if (score) return setOf(score);
      return isGradedAutomatically(previous, row) ? CLEAR : KEEP;
    }),
  }),
  // Before the lock the normal lock flow grades with the new key.
  batch: ({ question, rows, hasBatchRun }) =>
    hasBatchRun
      ? {
          rescored: true,
          writes: gradeClosestGuessBatch(
            question,
            rows.map((row) => row.value),
          ).map(setOf),
        }
      : { rescored: false, writes: [] },
};

/** What a live answer-key fix does to the stored grades of the corrected question. */
export function gradeOnKeyFix(input: KeyFixInput): KeyFixResult {
  return KEY_FIX[QUESTION_KINDS[input.question.type].gradingMode](input);
}

/** Whether the quiz master may hand-grade this stored answer now. */
export function canGradeByHand(
  question: Pick<ScoredQuestion, 'type'>,
  stored: { gradedAt: Date | null },
): boolean {
  return CAN_GRADE_BY_HAND[QUESTION_KINDS[question.type].gradingMode](stored);
}
