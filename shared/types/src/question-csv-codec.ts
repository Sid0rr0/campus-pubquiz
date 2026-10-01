import type { ImportQuestionPreview } from './import';
import type { QuestionIssue } from './question-kind';
import { splitPipeList } from './sort-match';

/**
 * The part of the sheet format that differs by question type: how the
 * `options` and `answer` cells carry a question's choices and answer. Each
 * Question kind entry owns one; the common columns (question, points, media,
 * notes) and round-level cells are handled once in question-row-schema.ts.
 */
export interface QuestionCsvCodec {
  /** Reads the cells into ImportQuestionPreview fields for the kind's schema to validate. */
  decode(cells: QuestionChoiceCells): DecodedChoices;
  /** Writes the cells so `decode` reads the same question back. */
  encode(question: ImportQuestionPreview): QuestionChoiceCells;
}

export interface QuestionChoiceCells {
  options: string;
  answer: string;
}

export interface DecodedChoices {
  answer: string;
  options?: string[];
  matchTargets?: string[];
  /** Set when the answer cell is malformed in a way the question schema can't see. */
  answerIssue?: QuestionIssue;
}

const LIST_SEPARATOR = '|';
const PAIR_SEPARATOR = '+';

function splitOptions(rawOptions: string): string[] {
  return rawOptions
    .split(LIST_SEPARATOR)
    .map((option) => option.trim())
    .filter((option) => option !== '');
}

/** No choices: the answer is the whole answer cell (free_text, audio, youtube, closest_guess). */
export const answerOnlyCsv: QuestionCsvCodec = {
  decode: ({ answer }) => ({ answer: answer.trim() }),
  encode: (question) => ({ options: '', answer: question.answer }),
};

/** Pipe-separated options; the answer is one of them, as written. */
export const choicesCsv: QuestionCsvCodec = {
  decode: ({ options, answer }) => ({
    answer: answer.trim(),
    options: splitOptions(options),
  }),
  encode: (question) => ({
    options: (question.options ?? []).join(LIST_SEPARATOR),
    answer: question.answer,
  }),
};

/** Like `choicesCsv`, but the answer is the options' correct order, stored in one canonical form. */
export const sortCsv: QuestionCsvCodec = {
  decode: (cells) => ({
    ...choicesCsv.decode(cells),
    answer: splitPipeList(cells.answer).join(LIST_SEPARATOR),
  }),
  encode: choicesCsv.encode,
};

// A `match` row's `options` cell packs both lists into one string, split by
// a single `+`: `left1|left2+right1|right2`. Always returns arrays (never
// undefined) so the schema's `.min(2, "…")` messages fire instead of a
// generic type-mismatch error when the cell is malformed.
function splitMatchOptions(rawOptions: string): {
  left: string[];
  right: string[];
} {
  const separatorIndex = rawOptions.indexOf(PAIR_SEPARATOR);
  if (separatorIndex === -1) {
    return { left: splitOptions(rawOptions), right: [] };
  }
  return {
    left: splitOptions(rawOptions.slice(0, separatorIndex)),
    right: splitOptions(rawOptions.slice(separatorIndex + 1)),
  };
}

/**
 * A `match` row's `answer` cell lists correct pairs as `left+right`,
 * pipe-separated, in any order (e.g. "arthur+excalibur|robin hood+bow").
 * Reorders them into `left`'s order so the stored answer is directly
 * comparable (by exact string equality) to a player's submitted value, which
 * is built positionally the same way — see AnswerForm's match UI. Returns
 * undefined if the pairs don't form a perfect one-to-one matching between
 * `left` and `right`.
 */
export function toCanonicalMatchAnswer(
  rawAnswer: string,
  left: string[],
  right: string[],
): string | undefined {
  const pairs = splitPipeList(rawAnswer).map((pair) => {
    const separatorIndex = pair.indexOf(PAIR_SEPARATOR);
    if (separatorIndex === -1) return undefined;
    const pairLeft = pair.slice(0, separatorIndex).trim();
    const pairRight = pair.slice(separatorIndex + 1).trim();
    return pairLeft && pairRight
      ? { left: pairLeft, right: pairRight }
      : undefined;
  });
  if (
    pairs.length !== left.length ||
    pairs.some((pair) => pair === undefined)
  ) {
    return undefined;
  }

  const rightByLeft = new Map(pairs.map((pair) => [pair!.left, pair!.right]));
  if (rightByLeft.size !== left.length) return undefined;

  const usedRight = new Set<string>();
  const canonical: string[] = [];
  for (const leftItem of left) {
    const rightItem = rightByLeft.get(leftItem);
    if (
      rightItem === undefined ||
      !right.includes(rightItem) ||
      usedRight.has(rightItem)
    ) {
      return undefined;
    }
    usedRight.add(rightItem);
    canonical.push(rightItem);
  }
  return canonical.join(LIST_SEPARATOR);
}

/**
 * Both lists packed into `options`; the answer as explicit `left+right`
 * pairs. Stored, the answer is the right item for each left item in left
 * order. An answer that isn't a clean one-to-one pairing is passed through
 * raw (so the schema rejects it on `answer`) and flagged as `answerIssue`,
 * since a bare right-hand list is a valid draft answer the schema accepts.
 */
export const matchCsv: QuestionCsvCodec = {
  decode: ({ options, answer }) => {
    const { left, right } = splitMatchOptions(options);
    const trimmedAnswer = answer.trim();
    const canonical = toCanonicalMatchAnswer(trimmedAnswer, left, right);
    return {
      answer: canonical ?? trimmedAnswer,
      options: left,
      matchTargets: right,
      answerIssue:
        canonical === undefined
          ? {
              path: ['answer'],
              code: 'custom',
              message:
                'Answer must pair each left item with a right item, e.g. "left1+right1|left2+right2"',
            }
          : undefined,
    };
  },
  encode: (question) => {
    const left = question.options ?? [];
    const rightItems = splitPipeList(question.answer);
    const targets = question.matchTargets ?? [];
    return {
      options: `${left.join(LIST_SEPARATOR)}${PAIR_SEPARATOR}${targets.join(LIST_SEPARATOR)}`,
      answer: left
        .map(
          (item, index) => `${item}${PAIR_SEPARATOR}${rightItems[index] ?? ''}`,
        )
        .join(LIST_SEPARATOR),
    };
  },
};
