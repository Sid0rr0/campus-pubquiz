import { IDK_ANSWER_VALUE } from './answers';
import { QUESTION_KINDS, type AnswerInputKind } from './question-kind';
import type { QuestionType } from './question-types';
import type { MatchScoringMode } from './question-views';
import { halfPoints, nearestHalfPoint } from './score-math';
import { splitPipeList } from './sort-match';

/**
 * How a question is answered: typed text, a number, picking a choice, putting
 * items in order, or pairing items up. Resolved from the question (type plus
 * whether it carries choices) by `resolveAnswerKind`, never by branching on
 * the type or on `options` at the call site.
 */
export type AnswerKind = AnswerInputKind;

/** The slice of a question the resolver needs — QuestionView satisfies it. */
export interface AnswerKindQuestion {
  type: QuestionType;
  options?: readonly string[] | null;
}

/**
 * A `required`-choices type is always `choice`; an `optional`-choices type is
 * `choice` once at least one choice has text and otherwise its registry input
 * kind; every other type takes its registry input kind.
 */
export function resolveAnswerKind(question: AnswerKindQuestion): AnswerKind {
  const entry = QUESTION_KINDS[question.type];
  if (entry.choices === 'required') return 'choice';
  if (
    entry.choices === 'optional' &&
    (question.options ?? []).some((option) => option.trim() !== '')
  ) {
    return 'choice';
  }
  return entry.inputKind;
}

export type Verdict = 'correct' | 'partial' | 'incorrect';

export interface ScoreResult {
  points: number;
  verdict: Verdict;
}

/** What an answer format needs of a question to compare an answer with the key. */
export interface KeyedQuestion {
  answer: string;
  points: number;
  /** Match only: undefined behaves as 'partial'. */
  matchScoringMode?: MatchScoringMode;
}

type ScoreAgainstKey = (question: KeyedQuestion, value: string) => ScoreResult;

/** One answer kind's stored string: its parts, how to read it and how it is scored. */
export interface AnswerFormat<Parts> {
  decode(stored: string): Parts;
  encode(parts: Parts): string;
  /** The readable text for a stored answer; `leftItems` are a match question's left-hand items. */
  format(stored: string, leftItems?: readonly string[]): string;
  /** Base score and verdict against the key; null when there is no per-answer score (closest_guess is batch-graded). */
  score: ScoreAgainstKey | null;
}

const INCORRECT: ScoreResult = { points: 0, verdict: 'incorrect' };

const correct = (question: KeyedQuestion): ScoreResult => ({
  points: question.points,
  verdict: 'correct',
});

function normalizeFreeText(value: string): string {
  return value.trim().toLowerCase();
}

/** Whether a typed (or option-picked) value equals the key: trimmed and case-insensitive. */
export function matchesKey(question: KeyedQuestion, value: string): boolean {
  return normalizeFreeText(value) === normalizeFreeText(question.answer);
}

const asIs = (stored: string): string => stored;

const textFormat: AnswerFormat<string> = {
  decode: asIs,
  encode: asIs,
  format: asIs,
  score: (question, value) =>
    matchesKey(question, value) ? correct(question) : INCORRECT,
};

const numberFormat: AnswerFormat<string> = {
  decode: asIs,
  encode: asIs,
  format: asIs,
  score: null,
};

const choiceFormat: AnswerFormat<string> = {
  decode: asIs,
  encode: asIs,
  format: asIs,
  score: (question, value) =>
    value === question.answer ? correct(question) : INCORRECT,
};

const sortFormat: AnswerFormat<string[]> = {
  decode: splitPipeList,
  encode: (items) => items.join('|'),
  format: (stored) => splitPipeList(stored).join(' → '),
  // Stray whitespace and empty items don't cost a team the question.
  score: (question, value) =>
    splitPipeList(value).join('|') === splitPipeList(question.answer).join('|')
      ? correct(question)
      : INCORRECT,
};

/**
 * Both stored strings are pipe-joined right-hand items in the question's
 * left-hand (`options`) order, so comparing positionally counts correctly
 * matched pairs.
 */
const matchFormat: AnswerFormat<string[]> = {
  decode: splitPipeList,
  encode: (items) => items.join('|'),
  format: (stored, leftItems) => {
    const rightItems = splitPipeList(stored);
    if (leftItems && leftItems.length === rightItems.length) {
      return leftItems
        .map((left, index) => `${left} → ${rightItems[index]}`)
        .join(', ');
    }
    return rightItems.join(' → ');
  },
  score: (question, value) => {
    const answerPairs = splitPipeList(question.answer);
    const submittedPairs = splitPipeList(value);
    const correctPairCount = answerPairs.filter(
      (rightItem, index) => rightItem === submittedPairs[index],
    ).length;
    const wrongPairCount = answerPairs.length - correctPairCount;
    if (wrongPairCount === 0) return correct(question);
    if (question.matchScoringMode === 'all_or_nothing') {
      return wrongPairCount === 1
        ? { points: halfPoints(question.points), verdict: 'partial' }
        : INCORRECT;
    }
    return {
      points: nearestHalfPoint(
        (question.points * correctPairCount) / answerPairs.length,
      ),
      verdict: correctPairCount === 0 ? 'incorrect' : 'partial',
    };
  },
};

/** One format per answer kind; a kind without one is a compile error. */
export const ANSWER_FORMATS = {
  text: textFormat,
  number: numberFormat,
  choice: choiceFormat,
  sort: sortFormat,
  match: matchFormat,
} satisfies { readonly [K in AnswerKind]: AnswerFormat<unknown> };

/** A stored answer as text people read; "I don't know" is handled here, once, in front of every format. */
export function formatAnswer(
  stored: string,
  question: AnswerKindQuestion,
): string {
  if (stored === IDK_ANSWER_VALUE) return "🤷 I don't know";
  return ANSWER_FORMATS[resolveAnswerKind(question)].format(
    stored,
    question.options ?? undefined,
  );
}
