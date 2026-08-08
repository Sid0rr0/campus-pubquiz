import {
  splitPipeList,
  type ImportQuestionPreview,
  type ImportRoundPreview,
  type QuestionType,
  type QuizDraftSaveRequest,
} from '@campus-pubquiz/types';

export interface EditorOption {
  text: string;
  isCorrect: boolean;
}

export interface EditorMatchPair {
  left: string;
  right: string;
}

/**
 * One question's editable fields. `options` is only meaningful for
 * `multiple_choice`; `sortItems` (entered in *correct* order) for `sort`;
 * `matchPairs` for `match`; `correctText` holds the answer for the remaining
 * types. Saving shuffles `sortItems`/the right side of `matchPairs` into a
 * fresh display order — see questionToPreview.
 */
export interface EditorQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  notes: string;
  options: EditorOption[];
  sortItems: string[];
  matchPairs: EditorMatchPair[];
  correctText: string;
  mediaUrl: string;
  answerMediaUrl: string;
}

export interface EditorRound {
  id: string;
  title: string;
  breakAfter: boolean;
  questions: EditorQuestion[];
}

export function makeOption(text = ''): EditorOption {
  return { text, isCorrect: false };
}

export function makeMatchPair(left = '', right = ''): EditorMatchPair {
  return { left, right };
}

export function makeQuestion(id: string): EditorQuestion {
  return {
    id,
    type: 'multiple_choice',
    prompt: '',
    points: 1,
    notes: '',
    options: [makeOption(), makeOption()],
    sortItems: ['', ''],
    matchPairs: [makeMatchPair(), makeMatchPair()],
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

export function makeRound(id: string, title = ''): EditorRound {
  return { id, title, breakAfter: false, questions: [] };
}

/** Converts a saved/imported question into editable state — marks whichever multiple-choice option matches `answer` as correct. */
export function questionFromPreview(
  id: string,
  question: ImportQuestionPreview,
): EditorQuestion {
  const isMc = question.type === 'multiple_choice';
  const isSort = question.type === 'sort';
  const isMatch = question.type === 'match';
  // sortItems/matchPairs reconstruct from `answer` (the correct order/pairing),
  // not `options`/`matchTargets` (the display order) — re-saving picks a fresh
  // display shuffle, same as a freshly authored question.
  const answerItems = isSort || isMatch ? splitPipeList(question.answer) : [];
  return {
    id,
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
    correctText: isMc || isSort || isMatch ? '' : question.answer,
    mediaUrl: question.mediaUrl ?? '',
    answerMediaUrl: question.answerMediaUrl ?? '',
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
    questions: round.questions.map((question, index) =>
      questionFromPreview(makeQuestionId(index), question),
    ),
  };
}

/** Converts editable state back into the API shape — derives `answer` from whichever option is marked correct, trims text, and drops blank optional fields. */
export function questionToPreview(
  question: EditorQuestion,
): ImportQuestionPreview {
  const isMc = question.type === 'multiple_choice';
  const isSort = question.type === 'sort';
  const isMatch = question.type === 'match';
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
    ...(isSort ? { options: shuffled(sortItems) } : {}),
    ...(isMatch
      ? {
          options: matchPairs.map((pair) => pair.left),
          matchTargets: shuffled(matchPairs.map((pair) => pair.right)),
        }
      : {}),
    ...(mediaUrl ? { mediaUrl } : {}),
    ...(answerMediaUrl ? { answerMediaUrl } : {}),
  };
}

export function toSaveRequest(
  title: string,
  rounds: EditorRound[],
): QuizDraftSaveRequest {
  return {
    title: title.trim(),
    rounds: rounds.map((round) => ({
      title: round.title.trim(),
      breakAfter: round.breakAfter,
      questions: round.questions.map(questionToPreview),
    })),
  };
}
