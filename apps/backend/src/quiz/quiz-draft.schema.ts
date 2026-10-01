import {
  isKahootAllowedType,
  questionPreviewSchema,
  ROUND_CATEGORIES,
  type QuizDraftIssue,
  type QuizDraftSaveRequest,
} from '@campus-pubquiz/types';

/**
 * Validates a full quiz draft (manual edits and/or a CSV-import preview
 * carried into the editor) before it's persisted. Never throws — every
 * problem becomes a `QuizDraftIssue` the editor UI can point at. `roundIndex:
 * -1` marks a quiz-level issue (missing title, no rounds at all);
 * `questionIndex: null` marks a round-level issue (missing round title, no
 * questions in the round).
 */
export function validateQuizDraft(
  request: QuizDraftSaveRequest,
): QuizDraftIssue[] {
  const issues: QuizDraftIssue[] = [];

  if (request.title.trim() === '') {
    issues.push({
      roundIndex: -1,
      questionIndex: null,
      field: 'title',
      message: 'Missing quiz title',
    });
  }
  if (request.rounds.length === 0) {
    issues.push({
      roundIndex: -1,
      questionIndex: null,
      field: 'rounds',
      message: 'Quiz needs at least one round',
    });
  }

  request.rounds.forEach((round, roundIndex) => {
    if (round.title.trim() === '') {
      issues.push({
        roundIndex,
        questionIndex: null,
        field: 'title',
        message: 'Missing round title',
      });
    }
    if (round.questions.length === 0) {
      issues.push({
        roundIndex,
        questionIndex: null,
        field: 'questions',
        message: 'Round needs at least one question',
      });
    }
    if (
      round.kahootMode !== undefined &&
      typeof round.kahootMode !== 'boolean'
    ) {
      issues.push({
        roundIndex,
        questionIndex: null,
        field: 'kahootMode',
        message: 'Kahoot mode must be true or false',
      });
    }
    if (
      round.category !== undefined &&
      !(ROUND_CATEGORIES as readonly string[]).includes(round.category)
    ) {
      issues.push({
        roundIndex,
        questionIndex: null,
        field: 'category',
        message: `Category must be one of: ${ROUND_CATEGORIES.join(', ')}`,
      });
    }
    if (round.author !== undefined && typeof round.author !== 'string') {
      issues.push({
        roundIndex,
        questionIndex: null,
        field: 'author',
        message: 'Author must be text',
      });
    }

    round.questions.forEach((question, questionIndex) => {
      const parsed = questionPreviewSchema.safeParse(question);
      if (parsed.success) {
        if (round.kahootMode && !isKahootAllowedType(question.type)) {
          issues.push({
            roundIndex,
            questionIndex,
            field: 'type',
            message:
              'Kahoot rounds only support multiple choice, sort, and match questions',
          });
        }
        return;
      }
      for (const issue of parsed.error.issues) {
        issues.push({
          roundIndex,
          questionIndex,
          field: String(issue.path[0] ?? 'question'),
          message: issue.message,
        });
      }
    });
  });

  return issues;
}
