import { IDK_ANSWER_VALUE } from './answers';
import { QUESTION_KINDS, type AnswerInputKind } from './question-kind';
import type { QuestionType } from './question-types';
import type { ResolvedAnswerKey } from './answer-key';
import { isWithinMargin, parseFiniteNumber } from './margin';
import { ALL_OR_NOTHING_MATCH_SCORING } from './match-scoring-mode';
import { halfPoints, nearestHalfPoint } from './score-math';
import { splitPipeList } from './sort-match';

/**
 * How a question is answered: typed text, a number, picking a choice, putting
 * items in order, or pairing items up. Resolved from the question's type by
 * `resolveAnswerKind`, never by branching on the type or on `options` at the
 * call site.
 */
export type AnswerKind = AnswerInputKind;

/** The slice of a question the resolver needs — QuestionView satisfies it. */
export interface AnswerKindQuestion {
  type: QuestionType;
}

/**
 * A `required`-choices type is always `choice`; every other type takes its
 * registry input kind.
 */
export function resolveAnswerKind(question: AnswerKindQuestion): AnswerKind {
  const entry = QUESTION_KINDS[question.type];
  if (entry.choices === 'required') return 'choice';
  return entry.inputKind;
}

export type Verdict = 'correct' | 'partial' | 'incorrect';

export interface ScoreResult {
  points: number;
  verdict: Verdict;
}

/** A format compares an answer with a resolved Answer key: settings required, so it reads them directly and defaults nothing. */
type ScoreAgainstKey = (
  question: ResolvedAnswerKey,
  value: string,
) => ScoreResult;

/** One answer kind's stored string: its parts, how to read it and how it is scored. */
export interface AnswerFormat<Parts> {
  decode(stored: string): Parts;
  encode(parts: Parts): string;
  /** The readable text for a stored answer; `leftItems` are a match question's left-hand items. */
  format(stored: string, leftItems?: readonly string[]): string;
  /** Base score and verdict against the key. */
  score: ScoreAgainstKey;
}

const INCORRECT: ScoreResult = { points: 0, verdict: 'incorrect' };

const correct = (question: ResolvedAnswerKey): ScoreResult => ({
  points: question.points,
  verdict: 'correct',
});

function normalizeFreeText(value: string): string {
  return value.trim().toLowerCase();
}

/** Whether a typed (or option-picked) value equals the key: trimmed and case-insensitive. */
export function matchesKey(
  question: Pick<ResolvedAnswerKey, 'answer'>,
  value: string,
): boolean {
  return normalizeFreeText(value) === normalizeFreeText(question.answer);
}

const asIs = (stored: string): string => stored;

/** The as-is codec: the stored string is the one part. */
const asIsCodec = { decode: asIs, encode: asIs } as const;

/** The pipe-list codec: the stored string is `|`-joined items. */
const pipeListCodec = {
  decode: splitPipeList,
  encode: (items: string[]): string => items.join('|'),
} as const;

const textFormat: AnswerFormat<string> = {
  ...asIsCodec,
  format: asIs,
  score: (question, value) =>
    matchesKey(question, value) ? correct(question) : INCORRECT,
};

/** Inside the margin (edges included) is correct with full points, anything else, including a non-number, incorrect. */
const numberFormat: AnswerFormat<string> = {
  ...asIsCodec,
  format: asIs,
  score: (question, value) => {
    const key = parseFiniteNumber(question.answer);
    const answer = parseFiniteNumber(value);
    if (key === null || answer === null) return INCORRECT;
    return isWithinMargin(key, answer, question.margin)
      ? correct(question)
      : INCORRECT;
  },
};

const choiceFormat: AnswerFormat<string> = {
  ...asIsCodec,
  format: asIs,
  score: (question, value) =>
    value === question.answer ? correct(question) : INCORRECT,
};

const sortFormat: AnswerFormat<string[]> = {
  ...pipeListCodec,
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
  ...pipeListCodec,
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
    if (question.matchScoringMode === ALL_OR_NOTHING_MATCH_SCORING) {
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

/**
 * A stored answer as text people read; "I don't know" is handled here, once,
 * in front of every format. sort/match answers are stored as a `|`-joined
 * string: sort shows as one arrow chain (the value *is* the order); match
 * values are positionally aligned to the question's `options` (the left
 * items), shown as "left → right" pairs, falling back to a bare chain when
 * `options` is missing or its length doesn't match.
 */
export function formatAnswer(
  stored: string,
  question: AnswerKindQuestion & { options?: readonly string[] | null },
): string {
  if (stored === IDK_ANSWER_VALUE) return "🤷 I don't know";
  return ANSWER_FORMATS[resolveAnswerKind(question)].format(
    stored,
    question.options ?? undefined,
  );
}
