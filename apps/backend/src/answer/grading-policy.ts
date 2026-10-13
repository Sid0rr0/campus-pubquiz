import {
  gradeAtSubmit,
  QUESTION_KINDS,
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

/** Whether the quiz master may hand-grade this stored answer now. */
export function canGradeByHand(
  question: Pick<ScoredQuestion, 'type'>,
  stored: { gradedAt: Date | null },
): boolean {
  return CAN_GRADE_BY_HAND[QUESTION_KINDS[question.type].gradingMode](stored);
}
