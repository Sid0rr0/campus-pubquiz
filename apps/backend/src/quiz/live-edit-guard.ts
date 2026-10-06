import {
  isRoundStructureFrozen,
  type ImportQuestionPreview,
  type ImportRoundPreview,
  type LiveEditFrontier,
  type QuizDraftIssue,
} from '@campus-pubquiz/types';

/** Thrown by `QuizController.update` when a save would violate `findLiveEditViolations` — mapped to 409 Conflict, distinct from `QuizDraftInvalidError`'s 422 for malformed payloads. */
export class QuizLiveEditBlockedError extends Error {
  constructor(public readonly issues: QuizDraftIssue[]) {
    super(
      `Cannot save — ${issues.length} change(s) conflict with the live session on this quiz`,
    );
    this.name = 'QuizLiveEditBlockedError';
  }
}

/** What teams already answered against — changing any of these on an opened question would make existing submissions meaningless (e.g. an MC option typo fix would zero every team that picked it, since grading is exact-match). */
const OPENED_QUESTION_FIELDS: (keyof ImportQuestionPreview)[] = [
  'type',
  'options',
  'matchTargets',
];

/** Inputs to auto-grading — a change on an opened question means existing answers need re-scoring. */
const GRADING_QUESTION_FIELDS: (keyof ImportQuestionPreview)[] = [
  'answer',
  'points',
  'matchScoringMode',
];

/** The last round always breaks (QuizService forces it at save), so its stored value never reflects the draft's. */
function effectiveBreakAfter(
  round: ImportRoundPreview,
  roundIndex: number,
  roundCount: number,
): boolean {
  return roundIndex === roundCount - 1 || round.breakAfter;
}

function diffQuestionFields(
  current: ImportQuestionPreview,
  incoming: ImportQuestionPreview,
  fields: (keyof ImportQuestionPreview)[],
): string[] {
  return fields.filter(
    (field) =>
      JSON.stringify(current[field]) !== JSON.stringify(incoming[field]),
  );
}

/**
 * Diffs a quiz draft about to be saved against its currently-persisted
 * rounds while a session is live on this quiz. Game progress is positional,
 * so nothing at or before the frontier may shift: rounds can't be added or
 * removed, a round's breakAfter/kahootMode can't change, and a round up to
 * the frontier's current round keeps exactly its questions in their order
 * (see isRoundStructureFrozen). Rounds after it can have questions added,
 * deleted, reordered and moved between them — that's why a save made after
 * a session reached an edited round is refused here too, naming the round.
 * A question in the frontier's `openedQuestionIds` (opened) can still have
 * its prompt/answer/points/notes/media fixed, but not its type or choices
 * (see OPENED_QUESTION_FIELDS); an upcoming question can be edited freely.
 * Returns the existing `QuizDraftIssue[]` shape so the editor's existing
 * issue-rendering UI needs no changes; empty when the incoming draft is safe
 * to save as-is.
 */
export function findLiveEditViolations(
  currentRounds: ImportRoundPreview[],
  incomingRounds: ImportRoundPreview[],
  frontier: LiveEditFrontier,
): QuizDraftIssue[] {
  const issues: QuizDraftIssue[] = [];
  const openedIds = new Set(frontier.openedQuestionIds);

  if (currentRounds.length !== incomingRounds.length) {
    issues.push({
      roundIndex: -1,
      questionIndex: null,
      field: 'rounds',
      message:
        'Cannot add or remove rounds while a session is live on this quiz',
    });
  }

  const roundCount = Math.min(currentRounds.length, incomingRounds.length);
  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const currentRound = currentRounds[roundIndex];
    const incomingRound = incomingRounds[roundIndex];

    // Game progress is positional over blocks, which breakAfter and kahootMode
    // both shape — changing either shifts what saved positions point at.
    const hasBlockShapeChanged = {
      // With a different round count the last round isn't the same one, and
      // the count mismatch above is already the issue to report.
      breakAfter:
        currentRounds.length === incomingRounds.length &&
        effectiveBreakAfter(currentRound, roundIndex, currentRounds.length) !==
          effectiveBreakAfter(incomingRound, roundIndex, incomingRounds.length),
      kahootMode:
        (currentRound.kahootMode ?? false) !==
        (incomingRound.kahootMode ?? false),
    };
    for (const [field, hasChanged] of Object.entries(hasBlockShapeChanged)) {
      if (!hasChanged) continue;
      issues.push({
        roundIndex,
        questionIndex: null,
        field,
        message: `Cannot change a round's ${field} while a session is live on this quiz`,
      });
    }

    // Rounds after the frontier are free to restructure; the opened-question
    // checks below only matter where opened questions can be.
    if (!isRoundStructureFrozen(frontier, roundIndex)) continue;

    if (currentRound.questions.length !== incomingRound.questions.length) {
      issues.push({
        roundIndex,
        questionIndex: null,
        field: 'questions',
        message:
          'Cannot add or remove questions in this round — a live session has already reached it',
      });
    }

    const questionCount = Math.min(
      currentRound.questions.length,
      incomingRound.questions.length,
    );
    for (
      let questionIndex = 0;
      questionIndex < questionCount;
      questionIndex += 1
    ) {
      const currentQuestion = currentRound.questions[questionIndex];
      const incomingQuestion = incomingRound.questions[questionIndex];

      if (currentQuestion.questionId !== incomingQuestion.questionId) {
        issues.push({
          roundIndex,
          questionIndex,
          field: 'questionId',
          message:
            'Cannot reorder or replace questions in this round — a live session has already reached it',
        });
        continue;
      }

      if (
        currentQuestion.questionId !== undefined &&
        openedIds.has(currentQuestion.questionId)
      ) {
        for (const field of diffQuestionFields(
          currentQuestion,
          incomingQuestion,
          OPENED_QUESTION_FIELDS,
        )) {
          issues.push({
            roundIndex,
            questionIndex,
            field,
            message:
              "Cannot change this question's type or choices — it is an opened question that teams may have answered",
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Ids of opened questions whose answer or points
 * differ between the persisted and incoming drafts — their existing answers
 * need re-grading once the save lands. Pairs questions by position, which is
 * only meaningful once findLiveEditViolations has confirmed the structure is
 * unchanged; the questionId check below keeps it safe regardless.
 */
export function findRegradeQuestionIds(
  currentRounds: ImportRoundPreview[],
  incomingRounds: ImportRoundPreview[],
  openedQuestionIds: readonly number[],
): number[] {
  const openedIds = new Set(openedQuestionIds);
  return currentRounds.flatMap((currentRound, roundIndex) =>
    currentRound.questions.flatMap((currentQuestion, questionIndex) => {
      const incomingQuestion =
        incomingRounds[roundIndex]?.questions[questionIndex];
      const { questionId } = currentQuestion;
      const needsRegrade =
        questionId !== undefined &&
        openedIds.has(questionId) &&
        incomingQuestion?.questionId === questionId &&
        diffQuestionFields(
          currentQuestion,
          incomingQuestion,
          GRADING_QUESTION_FIELDS,
        ).length > 0;
      return needsRegrade ? [questionId] : [];
    }),
  );
}
