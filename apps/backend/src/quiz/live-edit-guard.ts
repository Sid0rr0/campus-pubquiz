import {
  OPENED_QUESTION_FIXED_FIELDS,
  answerKeyOf,
  describeLiveEditRounds,
  isSameAnswerKey,
  type ImportQuestionPreview,
  type ImportRoundPreview,
  type LiveEditFrontier,
  type QuizDraftIssue,
  type RoundEditingDescription,
} from '@campus-pubquiz/types';

/** Thrown by `QuizController.update` when a save would violate `findLiveEditViolations` — mapped to 409 Conflict, distinct from `QuizDraftInvalidError`'s 422 for malformed payloads. */
export class QuizLiveEditBlockedError extends Error {
  constructor(
    public readonly issues: QuizDraftIssue[],
    message = `Cannot save — ${issues.length} change(s) conflict with a session played on this quiz`,
  ) {
    super(message);
    this.name = 'QuizLiveEditBlockedError';
  }
}

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
  fields: readonly (keyof ImportQuestionPreview)[],
): string[] {
  return fields.filter(
    (field) =>
      JSON.stringify(current[field]) !== JSON.stringify(incoming[field]),
  );
}

/** Why a frozen round can't change, for the editor's issue list — the current round only freezes once its block starts locking. */
function frozenReason(round: RoundEditingDescription): string {
  return round.lockReason === 'block-locking'
    ? 'its block has started locking — add the question to a later round instead'
    : 'a live session has already reached it';
}

/**
 * Question-structure issues in one round a session has reached. The questions
 * that must stay put keep their ids and positions: all of them in a `frozen`
 * round, the opened ones at the start in an `after-opened` round (the
 * questions after them can change freely there). Opened questions among them
 * also keep their type and choices.
 */
function findRoundQuestionViolations(
  roundIndex: number,
  currentRound: ImportRoundPreview,
  incomingRound: ImportRoundPreview,
  described: RoundEditingDescription,
  openedIds: ReadonlySet<number>,
): QuizDraftIssue[] {
  const issues: QuizDraftIssue[] = [];
  const isFrozen = described.structureEditing === 'frozen';
  const pinnedCount = described.pinnedQuestionCount;
  const hasLostPinned = isFrozen
    ? incomingRound.questions.length !== pinnedCount
    : incomingRound.questions.length < pinnedCount;
  if (hasLostPinned) {
    issues.push({
      roundIndex,
      questionIndex: null,
      field: 'questions',
      message: isFrozen
        ? `Cannot add or remove questions in this round — ${frozenReason(described)}`
        : 'Cannot remove or move opened questions out of this round',
    });
  }

  const checkedCount = Math.min(pinnedCount, incomingRound.questions.length);
  for (
    let questionIndex = 0;
    questionIndex < checkedCount;
    questionIndex += 1
  ) {
    const currentQuestion = currentRound.questions[questionIndex];
    const incomingQuestion = incomingRound.questions[questionIndex];

    if (currentQuestion.questionId !== incomingQuestion.questionId) {
      issues.push({
        roundIndex,
        questionIndex,
        field: 'questionId',
        message: isFrozen
          ? `Cannot reorder or replace questions in this round — ${frozenReason(described)}`
          : 'Cannot insert a question before, or reorder, opened questions — add it after the last opened one',
      });
      continue;
    }

    if (
      currentQuestion.questionId === undefined ||
      !openedIds.has(currentQuestion.questionId)
    ) {
      continue;
    }
    for (const field of diffQuestionFields(
      currentQuestion,
      incomingQuestion,
      OPENED_QUESTION_FIXED_FIELDS,
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
  return issues;
}

const FOREIGN_QUESTION_MESSAGE =
  'This question does not belong to this quiz — reload the editor and try again.';

/**
 * Issues for incoming questions that name a stored question id the quiz does
 * not hold. An id keys the save's upsert, so one from another quiz would move
 * that question, and the answers of every session played on it, into this one.
 * `current` is the quiz as stored.
 */
export function findForeignQuestionIds(
  current: readonly ImportRoundPreview[],
  incoming: readonly ImportRoundPreview[],
): QuizDraftIssue[] {
  const ownIds = new Set(
    current.flatMap((round) =>
      round.questions.flatMap(({ questionId }) =>
        questionId === undefined ? [] : [questionId],
      ),
    ),
  );
  return incoming.flatMap((round, roundIndex) =>
    round.questions.flatMap(({ questionId }, questionIndex) =>
      questionId !== undefined && !ownIds.has(questionId)
        ? [
            {
              roundIndex,
              questionIndex,
              field: 'questionId',
              message: FOREIGN_QUESTION_MESSAGE,
            },
          ]
        : [],
    ),
  );
}

const DROPPED_ANSWERED_MESSAGE =
  'Cannot delete a question teams have already answered in a played session — it would delete those answers and change past scores. Start a new quiz instead.';

/**
 * Issues for answered questions a save would drop. Deleting a question deletes
 * its stored answers with it (the database cascades), which rewrites the
 * scores of every session already played on the quiz, whether or not one is
 * running now. `answeredIds` are the stored questions with answers.
 */
export function findDroppedAnsweredQuestions(
  current: readonly ImportRoundPreview[],
  incoming: readonly ImportRoundPreview[],
  answeredIds: ReadonlySet<number>,
): QuizDraftIssue[] {
  const keptIds = new Set(
    incoming.flatMap((round) =>
      round.questions.flatMap(({ questionId }) =>
        questionId === undefined ? [] : [questionId],
      ),
    ),
  );
  return current.flatMap((round, roundIndex) =>
    round.questions.flatMap(({ questionId }, questionIndex) =>
      questionId !== undefined &&
      answeredIds.has(questionId) &&
      !keptIds.has(questionId)
        ? [
            {
              roundIndex,
              questionIndex,
              field: 'questionId',
              message: DROPPED_ANSWERED_MESSAGE,
            },
          ]
        : [],
    ),
  );
}

/**
 * Diffs a quiz draft about to be saved against its currently-persisted
 * rounds while a session is live on this quiz. Game progress is positional,
 * so nothing at or before the frontier may shift: the current round and every
 * earlier round stay in place with their breakAfter/kahootMode, a round before
 * the frontier's current round keeps exactly its questions in their order, and
 * so does the current round once its block has started locking (see
 * describeLiveEditRounds). Before that, the current round keeps its opened
 * questions at its start in order, and the questions after them can be
 * added, deleted, reordered and moved. Rounds after the current round are
 * free: they can be added, deleted and reordered, their breakAfter/kahootMode
 * can change, and their questions can move between them — that's why a save
 * made after a session reached an edited round is refused here too.
 * A question in the frontier's `openedQuestionIds` (opened) can still have
 * its prompt/answer/points/notes/media fixed, but not its type or choices
 * (see OPENED_QUESTION_FIXED_FIELDS); an upcoming question can be edited freely.
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

  const described = describeLiveEditRounds(
    frontier,
    currentRounds.map((round) => ({
      questionIds: round.questions.map((question) => question.questionId),
    })),
  );
  const reachedRoundCount = described.filter((round) => round.isReached).length;
  if (incomingRounds.length < reachedRoundCount) {
    issues.push({
      roundIndex: -1,
      questionIndex: null,
      field: 'rounds',
      message:
        'Cannot remove a round a live session has reached — only later rounds can be removed',
    });
  }

  // Rounds after the current round have no progress to preserve: they can be
  // added, deleted and reordered, and their breakAfter/kahootMode can change.
  const roundCount = Math.min(reachedRoundCount, incomingRounds.length);
  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const currentRound = currentRounds[roundIndex];
    const incomingRound = incomingRounds[roundIndex];

    issues.push(
      ...findBlockShapeViolations(
        roundIndex,
        currentRound,
        incomingRound,
        currentRounds.length,
        incomingRounds.length,
      ),
    );

    const roundDescription = described[roundIndex];
    // Stryker disable next-line ConditionalExpression: equivalent, this loop only visits reached rounds, which are never 'free' (a free round pins no questions, so skipping it changes nothing)
    if (roundDescription.structureEditing === 'free') continue;

    issues.push(
      ...findRoundQuestionViolations(
        roundIndex,
        currentRound,
        incomingRound,
        roundDescription,
        openedIds,
      ),
    );
  }

  return issues;
}

/**
 * Game progress is positional over blocks, which breakAfter and kahootMode
 * both shape — changing either on a round a session has reached shifts what
 * saved positions point at.
 */
function findBlockShapeViolations(
  roundIndex: number,
  currentRound: ImportRoundPreview,
  incomingRound: ImportRoundPreview,
  currentRoundCount: number,
  incomingRoundCount: number,
): QuizDraftIssue[] {
  // A round that becomes the last one (its later rounds were deleted) is
  // forced to break at save, which is the quiz ending there, not an edit.
  const isIncomingLast = roundIndex === incomingRoundCount - 1;
  const hasBlockShapeChanged = {
    breakAfter:
      !isIncomingLast &&
      effectiveBreakAfter(currentRound, roundIndex, currentRoundCount) !==
        incomingRound.breakAfter,
    kahootMode:
      (currentRound.kahootMode ?? false) !==
      (incomingRound.kahootMode ?? false),
  };
  return Object.entries(hasBlockShapeChanged)
    .filter(([, hasChanged]) => hasChanged)
    .map(([field]) => ({
      roundIndex,
      questionIndex: null,
      field,
      message: `Cannot change the ${field} of a round a live session has reached`,
    }));
}

/**
 * Ids of opened questions whose Answer key
 * (answer, points and grading settings, defaults filled in) differs between the persisted and incoming drafts — their existing answers
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
        !isSameAnswerKey(
          answerKeyOf(currentQuestion),
          answerKeyOf(incomingQuestion),
        );
      return needsRegrade ? [questionId] : [];
    }),
  );
}
