import { z } from 'zod';
import type { SheetRow } from './import';
import type { QuestionIssue } from './question-kind';
import type { QuestionType } from './question-types';
import { ROUND_CATEGORIES } from './round-category';
import { splitPipeList } from './sort-match';

/**
 * Sheet-only half of import validation. The question itself is validated by
 * the question kind's schema (`QUESTION_KINDS[type].schema`) after
 * `decodeSheetRow` turns the row into an ImportQuestionPreview-shaped
 * candidate; this file owns what only a sheet row has (round name,
 * break_after) and the mapping of issue paths back to sheet column names.
 */

// CSV/Sheets rows never carry kahootMode (it's manual-editor-only), so a
// blank points cell always falls back to the non-kahoot default.
const DEFAULT_POINTS = 1;

// Case-insensitive lookup so "science & nature" in a sheet still resolves to
// the canonical "Science & nature" — authors shouldn't have to match casing
// exactly.
const ROUND_CATEGORY_BY_LOWERCASE = new Map(
  ROUND_CATEGORIES.map((category) => [category.toLowerCase(), category]),
);

/** Resolves a raw category cell to its canonical casing, or '' if it's blank or doesn't match any known category — an unrecognized category is left blank rather than blocking the import. */
function resolveCategoryCell(rawCategory: string): string {
  const trimmed = rawCategory.trim();
  if (trimmed === '') return trimmed;
  return ROUND_CATEGORY_BY_LOWERCASE.get(trimmed.toLowerCase()) ?? '';
}

/** Round-level cells of a sheet row, keyed by sheet column name so issue paths are the field the author sees. */
export const sheetRowMetaSchema = z.object({
  round: z.string().min(1, 'Missing round name'),
  break_after: z.enum(['', '0', '1'], {
    error: 'break_after must be "1", "0", or blank',
  }),
  // Always '' or a canonical ROUND_CATEGORIES value by the time it reaches
  // here — resolveCategoryCell already blanked out anything unrecognized.
  category: z.string(),
  author: z.string().optional(),
});

export type SheetRowMeta = z.infer<typeof sheetRowMetaSchema>;

// The question schemas speak ImportQuestionPreview field names; sheet authors
// know the column names.
const SHEET_COLUMN_BY_QUESTION_FIELD: Record<string, string> = {
  prompt: 'question',
  mediaUrl: 'media_url',
  answerMediaUrl: 'answer_media_url',
  matchTargets: 'match_right',
};

/**
 * The sheet column an issue from a question schema belongs to. The one
 * cross-field issue on `matchTargets` is "left and right lists differ in
 * length", which the sheet reports against the shared `options` cell.
 */
export function sheetFieldForIssue(issue: QuestionIssue): string {
  const field = String(issue.path[0] ?? 'row');
  if (field === 'matchTargets' && issue.code === 'custom') return 'options';
  return SHEET_COLUMN_BY_QUESTION_FIELD[field] ?? field;
}

function splitOptions(rawOptions: string): string[] | undefined {
  const options = rawOptions
    .split('|')
    .map((option) => option.trim())
    .filter((option) => option !== '');
  return options.length > 0 ? options : undefined;
}

// A `match` row's `options` cell packs both lists into one string, split by
// a single `+`: `left1|left2+right1|right2`. Always returns arrays (never
// undefined) so the zod `.min(2, "…")` messages fire instead of a generic
// type-mismatch error when the cell is malformed.
function splitMatchOptions(rawOptions: string): {
  left: string[];
  right: string[];
} {
  const separatorIndex = rawOptions.indexOf('+');
  if (separatorIndex === -1) {
    return { left: splitOptions(rawOptions) ?? [], right: [] };
  }
  return {
    left: splitOptions(rawOptions.slice(0, separatorIndex)) ?? [],
    right: splitOptions(rawOptions.slice(separatorIndex + 1)) ?? [],
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
    const separatorIndex = pair.indexOf('+');
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
  return canonical.join('|');
}

/** Decodes a raw sheet row into its round-level cells and the question candidate the kind's schema validates. */
export function decodeSheetRow(
  row: SheetRow,
  type: QuestionType,
): {
  meta: unknown;
  question: { type: QuestionType } & Record<string, unknown>;
  /** Set when a match answer isn't written as `left+right` pairs — the question schema alone can't see that, as a bare right-hand list is a valid draft answer. */
  sheetAnswerIssue?: QuestionIssue;
} {
  const trimmedPoints = row.points.trim();
  const trimmedNotes = row.notes.trim();
  const trimmedAnswer = row.answer.trim();
  const trimmedMediaUrl = row.mediaUrl.trim();
  const trimmedAnswerMediaUrl = row.answerMediaUrl.trim();
  const matchOptions = splitMatchOptions(row.options);
  const options =
    type === 'match' ? matchOptions.left : (splitOptions(row.options) ?? []);
  const isUnpairedMatchAnswer =
    type === 'match' &&
    toCanonicalMatchAnswer(
      trimmedAnswer,
      matchOptions.left,
      matchOptions.right,
    ) === undefined;
  return {
    sheetAnswerIssue: isUnpairedMatchAnswer
      ? {
          path: ['answer'],
          code: 'custom',
          message:
            'Answer must pair each left item with a right item, e.g. "left1+right1|left2+right2"',
        }
      : undefined,
    meta: {
      round: row.round.trim(),
      break_after: row.breakAfter.trim(),
      category: resolveCategoryCell(row.category),
      author: row.author.trim() === '' ? undefined : row.author.trim(),
    },
    question: {
      type,
      prompt: row.question.trim(),
      answer: decodeAnswer(type, trimmedAnswer, matchOptions),
      notes: trimmedNotes === '' ? undefined : trimmedNotes,
      points: trimmedPoints === '' ? DEFAULT_POINTS : Number(trimmedPoints),
      options,
      matchTargets: matchOptions.right,
      mediaUrl: trimmedMediaUrl === '' ? undefined : trimmedMediaUrl,
      answerMediaUrl:
        trimmedAnswerMediaUrl === '' ? undefined : trimmedAnswerMediaUrl,
    },
  };
}

// Sort and match answers are stored in one canonical form; a match answer
// that isn't a clean one-to-one pairing is passed through raw so the schema
// rejects it on `answer`.
function decodeAnswer(
  type: QuestionType,
  answer: string,
  match: { left: string[]; right: string[] },
): string {
  if (type === 'sort') return splitPipeList(answer).join('|');
  if (type === 'match') {
    return toCanonicalMatchAnswer(answer, match.left, match.right) ?? answer;
  }
  return answer;
}
