import {
  isQuickfireAllowedType,
  quickfireTypesMessage,
  checkQuestion,
  ROUND_CATEGORIES,
  ROUND_NOTE_MAX_LENGTH,
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
    issues.push(
      ...roundShapeIssues(round, roundIndex),
      ...roundTextIssues(round, roundIndex),
      ...round.questions.flatMap((question, questionIndex) =>
        questionIssues(request.mode === 'quickfire', question, {
          roundIndex,
          questionIndex,
        }),
      ),
    );
  });

  return issues;
}

type DraftRound = QuizDraftSaveRequest['rounds'][number];

function roundIssue(
  roundIndex: number,
  field: string,
  message: string,
): QuizDraftIssue {
  return { roundIndex, questionIndex: null, field, message };
}

function roundShapeIssues(
  round: DraftRound,
  roundIndex: number,
): QuizDraftIssue[] {
  const issues: QuizDraftIssue[] = [];
  if (round.title.trim() === '') {
    issues.push(roundIssue(roundIndex, 'title', 'Missing round title'));
  }
  if (round.questions.length === 0) {
    issues.push(
      roundIssue(roundIndex, 'questions', 'Round needs at least one question'),
    );
  }
  if (
    round.category !== undefined &&
    !(ROUND_CATEGORIES as readonly string[]).includes(round.category)
  ) {
    issues.push(
      roundIssue(
        roundIndex,
        'category',
        `Category must be one of: ${ROUND_CATEGORIES.join(', ')}`,
      ),
    );
  }
  return issues;
}

function roundTextIssues(
  round: DraftRound,
  roundIndex: number,
): QuizDraftIssue[] {
  const issues: QuizDraftIssue[] = [];
  if (round.author !== undefined && typeof round.author !== 'string') {
    issues.push(roundIssue(roundIndex, 'author', 'Author must be text'));
  }
  if (
    round.showNoteOnScreen !== undefined &&
    typeof round.showNoteOnScreen !== 'boolean'
  ) {
    issues.push(
      roundIssue(
        roundIndex,
        'showNoteOnScreen',
        'Show on screen must be true or false',
      ),
    );
  }
  if (round.note !== undefined && typeof round.note !== 'string') {
    issues.push(roundIssue(roundIndex, 'note', 'Round note must be text'));
  } else if (round.note && round.note.trim().length > ROUND_NOTE_MAX_LENGTH) {
    issues.push(
      roundIssue(
        roundIndex,
        'note',
        `Round note must be at most ${ROUND_NOTE_MAX_LENGTH} characters`,
      ),
    );
  }
  return issues;
}

function questionIssues(
  quickfire: boolean,
  question: DraftRound['questions'][number],
  position: { roundIndex: number; questionIndex: number },
): QuizDraftIssue[] {
  const checked = checkQuestion(question);
  if (!checked.success) {
    return checked.issues.map((issue) => ({
      ...position,
      field: String(issue.path[0] ?? 'question'),
      message: issue.message,
    }));
  }
  return quickfire && !isQuickfireAllowedType(question.type)
    ? [{ ...position, field: 'type', message: quickfireTypesMessage() }]
    : [];
}
