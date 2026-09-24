import type {
  ImportQuestionPreview,
  ImportRoundPreview,
  QuizDraftIssue,
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

/** What teams already answered against — changing any of these on a shown question would make existing submissions meaningless (e.g. an MC option typo fix would zero every team that picked it, since grading is exact-match). */
const LOCKED_QUESTION_FIELDS: (keyof ImportQuestionPreview)[] = [
  'type',
  'options',
  'matchTargets',
];

/** Inputs to auto-grading — a change on a shown question means existing answers need re-scoring. */
const GRADING_QUESTION_FIELDS: (keyof ImportQuestionPreview)[] = [
  'answer',
  'points',
];

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
 * rounds while a session is live on this quiz. Fix-in-place only: any
 * structural change (adding/removing/reordering rounds or questions) is
 * rejected outright, regardless of lock state — game progress is positional,
 * so a shift would move the game onto a different question. A question in
 * `lockedQuestionIds` (already shown or in progress) can still have its
 * prompt/answer/points/notes/media fixed, but not its type or choices (see
 * LOCKED_QUESTION_FIELDS); an upcoming question can be edited freely. Returns the existing `QuizDraftIssue[]` shape so the editor's
 * existing issue-rendering UI needs no changes; empty when the incoming
 * draft is safe to save as-is.
 */
export function findLiveEditViolations(
  currentRounds: ImportRoundPreview[],
  incomingRounds: ImportRoundPreview[],
  lockedQuestionIds: readonly number[],
): QuizDraftIssue[] {
  const issues: QuizDraftIssue[] = [];
  const lockedIds = new Set(lockedQuestionIds);

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

    if (currentRound.questions.length !== incomingRound.questions.length) {
      issues.push({
        roundIndex,
        questionIndex: null,
        field: 'questions',
        message:
          'Cannot add or remove questions in this round while a session is live',
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
            'Cannot reorder or replace questions while a session is live',
        });
        continue;
      }

      if (
        currentQuestion.questionId !== undefined &&
        lockedIds.has(currentQuestion.questionId)
      ) {
        for (const field of diffQuestionFields(
          currentQuestion,
          incomingQuestion,
          LOCKED_QUESTION_FIELDS,
        )) {
          issues.push({
            roundIndex,
            questionIndex,
            field,
            message:
              "Cannot change this question's type or choices — teams have already answered it",
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Ids of locked (already shown/in-progress) questions whose answer or points
 * differ between the persisted and incoming drafts — their existing answers
 * need re-grading once the save lands. Pairs questions by position, which is
 * only meaningful once findLiveEditViolations has confirmed the structure is
 * unchanged; the questionId check below keeps it safe regardless.
 */
export function findRegradeQuestionIds(
  currentRounds: ImportRoundPreview[],
  incomingRounds: ImportRoundPreview[],
  lockedQuestionIds: readonly number[],
): number[] {
  const lockedIds = new Set(lockedQuestionIds);
  return currentRounds.flatMap((currentRound, roundIndex) =>
    currentRound.questions.flatMap((currentQuestion, questionIndex) => {
      const incomingQuestion =
        incomingRounds[roundIndex]?.questions[questionIndex];
      const { questionId } = currentQuestion;
      const needsRegrade =
        questionId !== undefined &&
        lockedIds.has(questionId) &&
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
