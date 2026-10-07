import {
  ANSWER_FORMATS,
  resolveAnswerKind,
  type AnswerKind,
  type ImportQuestionPreview,
} from '@campus-pubquiz/types';
import type { EditorQuestion } from '@/app/quizzes/[id]/quiz-draft-state';

/** The answer fields a question saves: its stored `answer` plus whichever of the choice-shaped fields its answer kind uses. */
export type SavedAnswer = Pick<ImportQuestionPreview, 'answer'> &
  Partial<
    Pick<ImportQuestionPreview, 'options' | 'matchTargets' | 'matchScoringMode'>
  >;

/** One answer kind's conversion between a stored question and the editor's draft, through that kind's answer format. */
interface AnswerKindDraft {
  /** The draft fields this kind fills from a stored question; the rest keep their blank defaults. */
  load(question: ImportQuestionPreview): Partial<EditorQuestion>;
  save(question: EditorQuestion): SavedAnswer;
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

function nonBlank(items: readonly string[]): string[] {
  return items.map((item) => item.trim()).filter((item) => item !== '');
}

const typedAnswerDraft: AnswerKindDraft = {
  load: (question) => ({ correctText: question.answer }),
  save: (question) => ({ answer: question.correctText.trim() }),
};

const choiceDraft: AnswerKindDraft = {
  load: (question) => ({
    options: (question.options ?? []).map((text) => ({
      text,
      isCorrect: text === question.answer,
    })),
  }),
  save: (question) => ({
    answer:
      question.options.find((option) => option.isCorrect)?.text.trim() ?? '',
    options: nonBlank(question.options.map((option) => option.text)),
  }),
};

// sortItems/matchPairs reconstruct from `answer` (the correct order/pairing),
// not `options`/`matchTargets` (the display order) — that display order is
// kept aside in savedDisplayOrder so re-saving doesn't reshuffle it.
const sortDraft: AnswerKindDraft = {
  load: (question) => {
    const items = ANSWER_FORMATS.sort.decode(question.answer);
    return {
      ...(items.length > 0 ? { sortItems: items } : {}),
      ...(question.options ? { savedDisplayOrder: [...question.options] } : {}),
    };
  },
  save: (question) => {
    const items = nonBlank(question.sortItems);
    return {
      answer: ANSWER_FORMATS.sort.encode(items),
      options: displayOrderFor(items, question.savedDisplayOrder),
    };
  },
};

const matchDraft: AnswerKindDraft = {
  load: (question) => {
    const rights = ANSWER_FORMATS.match.decode(question.answer);
    const lefts = question.options ?? [];
    return {
      matchScoringMode: question.matchScoringMode ?? 'partial',
      ...(lefts.length > 0
        ? {
            matchPairs: lefts.map((left, index) => ({
              left,
              right: rights[index] ?? '',
            })),
          }
        : {}),
      ...(question.matchTargets
        ? { savedDisplayOrder: [...question.matchTargets] }
        : {}),
    };
  },
  save: (question) => {
    const pairs = question.matchPairs
      .map((pair) => ({ left: pair.left.trim(), right: pair.right.trim() }))
      .filter((pair) => pair.left !== '' && pair.right !== '');
    return {
      answer: ANSWER_FORMATS.match.encode(pairs.map((pair) => pair.right)),
      options: pairs.map((pair) => pair.left),
      matchTargets: displayOrderFor(
        pairs.map((pair) => pair.right),
        question.savedDisplayOrder,
      ),
      matchScoringMode: question.matchScoringMode,
    };
  },
};

/** One entry per answer kind; a kind without one is a compile error. */
const ANSWER_KIND_DRAFTS = {
  text: typedAnswerDraft,
  number: typedAnswerDraft,
  choice: choiceDraft,
  sort: sortDraft,
  match: matchDraft,
} satisfies { readonly [K in AnswerKind]: AnswerKindDraft };

/** The draft fields a stored question fills, by the answer kind its choices give it. */
export function loadAnswerDraft(
  question: ImportQuestionPreview,
): Partial<EditorQuestion> {
  return ANSWER_KIND_DRAFTS[resolveAnswerKind(question)].load(question);
}

/** The answer fields to save for a draft, by the answer kind its choice texts give it. */
export function saveAnswerDraft(question: EditorQuestion): SavedAnswer {
  return ANSWER_KIND_DRAFTS[resolveDraftAnswerKind(question)].save(question);
}

/** The answer kind of a draft question: its type plus the texts of its choices. */
export function resolveDraftAnswerKind(
  question: Pick<EditorQuestion, 'type' | 'options'>,
): AnswerKind {
  return resolveAnswerKind({
    type: question.type,
    options: question.options.map((option) => option.text),
  });
}
