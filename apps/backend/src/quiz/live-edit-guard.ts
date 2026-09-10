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

const COMPARABLE_QUESTION_FIELDS: (keyof ImportQuestionPreview)[] = [
  'type',
  'prompt',
  'answer',
  'notes',
  'points',
  'options',
  'matchTargets',
  'mediaUrl',
  'answerMediaUrl',
];

function diffQuestionFields(
  current: ImportQuestionPreview,
  incoming: ImportQuestionPreview,
): string[] {
  return COMPARABLE_QUESTION_FIELDS.filter(
    (field) =>
      JSON.stringify(current[field]) !== JSON.stringify(incoming[field]),
  );
}

/**
 * Diffs a quiz draft about to be saved against its currently-persisted
 * rounds while a session is live on this quiz. Fix-in-place only: any
 * structural change (adding/removing/reordering rounds or questions) is
 * rejected outright, regardless of lock state, and a field edit on a
 * question in `lockedQuestionIds` (already shown or in progress) is
 * rejected too — everything else (an upcoming question's fields) is left
 * alone. Returns the existing `QuizDraftIssue[]` shape so the editor's
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
        )) {
          issues.push({
            roundIndex,
            questionIndex,
            field,
            message: 'Cannot edit this question — it has already been shown',
          });
        }
      }
    }
  }

  return issues;
}
