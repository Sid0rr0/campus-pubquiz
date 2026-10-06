import {
  QUESTION_KINDS,
  getOpenedPrefixLength,
  getRoundStructureEditing,
  splitPipeList,
  type ImportQuestionPreview,
  type ImportRoundPreview,
  type LiveEditFrontier,
  type MatchScoringMode,
  type QuestionType,
  type QuizDraftSaveRequest,
} from '@campus-pubquiz/types';

interface EditorOption {
  text: string;
  isCorrect: boolean;
}

interface EditorMatchPair {
  left: string;
  right: string;
}

/**
 * One question's editable fields. `options` is only meaningful for
 * `multiple_choice`; `sortItems` (entered in *correct* order) for `sort`;
 * `matchPairs` for `match`; `correctText` holds the answer for the remaining
 * types. Saving shuffles `sortItems`/the right side of `matchPairs` into a
 * fresh display order unless `savedDisplayOrder` still holds the same items
 * — see questionToPreview.
 */
export interface EditorQuestion {
  id: string;
  /** The persisted `Question.id` this editor row was loaded from — undefined for a brand-new question. Distinct from `id` (a client-generated React key); see `ImportQuestionPreview.questionId`. */
  dbId?: number;
  type: QuestionType;
  prompt: string;
  points: number;
  notes: string;
  options: EditorOption[];
  sortItems: string[];
  matchPairs: EditorMatchPair[];
  /** Match only — see MatchScoringMode. Defaults to 'partial'. */
  matchScoringMode: MatchScoringMode;
  correctText: string;
  mediaUrl: string;
  answerMediaUrl: string;
  /** The sort `options` / match `matchTargets` display order as last saved — reused on save while the items are unchanged, so re-saving doesn't reshuffle what players already see (and doesn't trip the live-edit guard on an opened question). */
  savedDisplayOrder?: string[];
}

export interface EditorRound {
  id: string;
  title: string;
  breakAfter: boolean;
  /** See RoundConfig.kahootMode — only settable here, never via CSV/Sheets import. */
  kahootMode: boolean;
  /** Round topic/theme — one of ROUND_CATEGORIES, or '' meaning unset. Picked from a fixed `<select>` in the editor. */
  category: string;
  /** Who wrote this round's questions — optional, blank string means unset. */
  author: string;
  questions: EditorQuestion[];
}

export function makeOption(text = ''): EditorOption {
  return { text, isCorrect: false };
}

export function makeMatchPair(left = '', right = ''): EditorMatchPair {
  return { left, right };
}

/** Kahoot rounds default new questions to 1000 points (Kahoot's own convention); every other round defaults to 1. */
export function makeQuestion(id: string, isKahoot = false): EditorQuestion {
  return {
    id,
    type: 'multiple_choice',
    prompt: '',
    points: isKahoot ? 1000 : 1,
    notes: '',
    options: [makeOption(), makeOption()],
    sortItems: ['', ''],
    matchPairs: [makeMatchPair(), makeMatchPair()],
    matchScoringMode: 'partial',
    correctText: '',
    mediaUrl: '',
    answerMediaUrl: '',
  };
}

/** Fisher-Yates on a fresh copy — never mutates `items`. Gives sort/match a display order distinct from the correct order/pairing declared in the editor. */
function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function hasSameItems(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedB = [...b].sort();
  return [...a].sort().every((item, index) => item === sortedB[index]);
}

/** Keeps the last-saved display order while it still holds exactly `items`; otherwise picks a fresh shuffle. */
function displayOrderFor(
  items: string[],
  savedDisplayOrder: string[] | undefined,
): string[] {
  return savedDisplayOrder && hasSameItems(items, savedDisplayOrder)
    ? [...savedDisplayOrder]
    : shuffled(items);
}

export function makeRound(id: string, title = ''): EditorRound {
  return {
    id,
    title,
    breakAfter: false,
    kahootMode: false,
    category: '',
    author: '',
    questions: [],
  };
}

/** Whether the question's answer is picked from its choices: always for a `required` kind, and for an `optional` kind once any choice has text. */
export function hasEditorChoices(question: EditorQuestion): boolean {
  const { choices } = QUESTION_KINDS[question.type];
  if (choices === 'optional') {
    return question.options.some((option) => option.text.trim() !== '');
  }
  return choices === 'required';
}

/** Converts a saved/imported question into editable state — marks whichever multiple-choice option matches `answer` as correct. */
export function questionFromPreview(
  id: string,
  question: ImportQuestionPreview,
): EditorQuestion {
  const { inputKind, choices } = QUESTION_KINDS[question.type];
  const isMc =
    choices === 'required' ||
    (choices === 'optional' && (question.options?.length ?? 0) > 0);
  const isSort = inputKind === 'sort';
  const isMatch = inputKind === 'match';
  // sortItems/matchPairs reconstruct from `answer` (the correct order/pairing),
  // not `options`/`matchTargets` (the display order) — that display order is
  // kept aside in savedDisplayOrder so re-saving doesn't reshuffle it.
  const answerItems = isSort || isMatch ? splitPipeList(question.answer) : [];
  const savedDisplayOrder = isSort
    ? question.options
    : isMatch
      ? question.matchTargets
      : undefined;
  return {
    id,
    ...(question.questionId !== undefined ? { dbId: question.questionId } : {}),
    type: question.type,
    prompt: question.prompt,
    points: question.points,
    notes: question.notes ?? '',
    options:
      isMc && question.options
        ? question.options.map((text) => ({
            text,
            isCorrect: text === question.answer,
          }))
        : [makeOption(), makeOption()],
    sortItems: isSort && answerItems.length > 0 ? answerItems : ['', ''],
    matchPairs:
      isMatch && question.options && question.options.length > 0
        ? question.options.map((left, index) =>
            makeMatchPair(left, answerItems[index] ?? ''),
          )
        : [makeMatchPair(), makeMatchPair()],
    matchScoringMode: question.matchScoringMode ?? 'partial',
    correctText: isMc || isSort || isMatch ? '' : question.answer,
    mediaUrl: question.mediaUrl ?? '',
    answerMediaUrl: question.answerMediaUrl ?? '',
    ...(savedDisplayOrder ? { savedDisplayOrder: [...savedDisplayOrder] } : {}),
  };
}

export function roundFromPreview(
  id: string,
  round: ImportRoundPreview,
  makeQuestionId: (questionIndex: number) => string,
): EditorRound {
  return {
    id,
    title: round.title,
    breakAfter: round.breakAfter,
    // CSV/Sheets previews never carry kahootMode — it's only ever set by
    // editing the round afterward in the manual editor.
    kahootMode: round.kahootMode ?? false,
    category: round.category ?? '',
    author: round.author ?? '',
    questions: round.questions.map((question, index) =>
      questionFromPreview(makeQuestionId(index), question),
    ),
  };
}

/**
 * Merges an imported CSV/Sheets preview into the rounds already in the editor,
 * rather than replacing them — lets an admin import just a round or a batch of
 * questions to add to a quiz they're already editing. A preview round whose
 * title matches an existing round (case/whitespace-insensitive) has its
 * questions appended to that round; every other preview round is added as a
 * brand-new round at the end. Existing rounds' own settings (breakAfter,
 * kahootMode, category, author) are left untouched by a match.
 */
export function mergeRoundsFromPreview(
  currentRounds: EditorRound[],
  previewRounds: ImportRoundPreview[],
  makeId: () => string,
): EditorRound[] {
  const merged = [...currentRounds];
  for (const previewRound of previewRounds) {
    const matchIndex = merged.findIndex(
      (round) =>
        round.title.trim().toLowerCase() ===
        previewRound.title.trim().toLowerCase(),
    );
    if (matchIndex === -1) {
      merged.push(roundFromPreview(makeId(), previewRound, () => makeId()));
      continue;
    }
    const importedQuestions = previewRound.questions.map((question) =>
      questionFromPreview(makeId(), question),
    );
    merged[matchIndex] = {
      ...merged[matchIndex],
      questions: [...merged[matchIndex].questions, ...importedQuestions],
    };
  }
  return merged;
}

/** Converts editable state back into the API shape — derives `answer` from whichever option is marked correct, trims text, and drops blank optional fields. */
export function questionToPreview(
  question: EditorQuestion,
): ImportQuestionPreview {
  const { inputKind } = QUESTION_KINDS[question.type];
  const isMc = hasEditorChoices(question);
  const isSort = inputKind === 'sort';
  const isMatch = inputKind === 'match';
  const sortItems = question.sortItems
    .map((item) => item.trim())
    .filter((item) => item !== '');
  const matchPairs = question.matchPairs
    .map((pair) => ({ left: pair.left.trim(), right: pair.right.trim() }))
    .filter((pair) => pair.left !== '' && pair.right !== '');
  const answer = isMc
    ? (question.options.find((option) => option.isCorrect)?.text.trim() ?? '')
    : isSort
      ? sortItems.join('|')
      : isMatch
        ? matchPairs.map((pair) => pair.right).join('|')
        : question.correctText.trim();
  const notes = question.notes.trim();
  const mediaUrl = question.mediaUrl.trim();
  const answerMediaUrl = question.answerMediaUrl.trim();

  return {
    ...(question.dbId !== undefined ? { questionId: question.dbId } : {}),
    type: question.type,
    prompt: question.prompt.trim(),
    answer,
    points: question.points,
    ...(notes ? { notes } : {}),
    ...(isMc
      ? {
          options: question.options
            .map((option) => option.text.trim())
            .filter((text) => text !== ''),
        }
      : {}),
    ...(isSort
      ? { options: displayOrderFor(sortItems, question.savedDisplayOrder) }
      : {}),
    ...(isMatch
      ? {
          options: matchPairs.map((pair) => pair.left),
          matchTargets: displayOrderFor(
            matchPairs.map((pair) => pair.right),
            question.savedDisplayOrder,
          ),
          matchScoringMode: question.matchScoringMode,
        }
      : {}),
    ...(mediaUrl ? { mediaUrl } : {}),
    ...(answerMediaUrl ? { answerMediaUrl } : {}),
  };
}

/** How many questions at the start of `round` (at `roundIndex`) a live session pins in place: all of them in a round the session has reached and whose block is locking, the opened ones in the current round before that, none after it or when nothing is live. */
export function getPinnedQuestionCount(
  round: EditorRound,
  roundIndex: number,
  liveEdit: LiveEditFrontier | undefined,
): number {
  if (!liveEdit) return 0;
  switch (getRoundStructureEditing(liveEdit, roundIndex)) {
    case 'frozen':
      return round.questions.length;
    case 'after-opened':
      return getOpenedPrefixLength(
        round.questions.map((question) => question.dbId),
        new Set(liveEdit.openedQuestionIds),
      );
    case 'free':
      return 0;
  }
}

/** Moves a question to the end of another round — the draft's way of changing which round a question plays in. Returns `rounds` itself when there is nothing to move. */
export function moveQuestionToRound(
  rounds: EditorRound[],
  questionId: string,
  targetRoundId: string,
): EditorRound[] {
  const source = rounds.find((round) =>
    round.questions.some((question) => question.id === questionId),
  );
  const target = rounds.find((round) => round.id === targetRoundId);
  if (!source || !target || source.id === target.id) return rounds;

  const question = source.questions.find((q) => q.id === questionId)!;
  return rounds.map((round) => {
    if (round.id === source.id) {
      return {
        ...round,
        questions: round.questions.filter((q) => q.id !== questionId),
      };
    }
    if (round.id === target.id) {
      return { ...round, questions: [...round.questions, question] };
    }
    return round;
  });
}

/**
 * Backfills server-assigned `dbId`s onto whichever questions were brand-new
 * as of the last save, matching `freshRounds` (the draft as reloaded right
 * after that save) to `rounds` by position. Deliberately touches nothing
 * else — a wholesale state replace here would discard whatever the admin
 * typed in the moment between clicking Save and this reload landing, which
 * is what previously made a second save look like it silently did nothing.
 */
export function withSyncedQuestionIds(
  rounds: EditorRound[],
  freshRounds: ImportRoundPreview[],
): EditorRound[] {
  return rounds.map((round, roundIndex) => {
    const freshQuestions = freshRounds[roundIndex]?.questions;
    if (!freshQuestions) return round;
    return {
      ...round,
      questions: round.questions.map((question, questionIndex) => {
        if (question.dbId !== undefined) return question;
        const freshId = freshQuestions[questionIndex]?.questionId;
        return freshId === undefined
          ? question
          : { ...question, dbId: freshId };
      }),
    };
  });
}

export function toSaveRequest(
  title: string,
  rounds: EditorRound[],
): QuizDraftSaveRequest {
  return {
    title: title.trim(),
    rounds: rounds.map((round, index) => ({
      title: round.title.trim(),
      // The state machine has no way to reveal answers otherwise, so the
      // last round's break is always forced on — see quiz.service.ts's
      // forceLastRoundBreak, which enforces this again server-side.
      breakAfter: index === rounds.length - 1 ? true : round.breakAfter,
      kahootMode: round.kahootMode,
      ...(round.category.trim() ? { category: round.category.trim() } : {}),
      ...(round.author.trim() ? { author: round.author.trim() } : {}),
      questions: round.questions.map(questionToPreview),
    })),
  };
}
