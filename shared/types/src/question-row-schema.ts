import { z } from 'zod';
import type { SheetRow } from './import';
import type { QuestionType } from './question-types';
import { ROUND_CATEGORIES } from './round-category';
import { isSameMultiset, splitPipeList } from './sort-match';
import { extractYoutubeVideoId } from './youtube';

/**
 * Import-path validation: one Zod schema per question type over a decoded
 * sheet row (`decodeSheetRow`). Schema keys use the sheet column names so Zod
 * issue paths map straight to the ImportRowIssue.field the quiz author sees.
 */

// CSV/Sheets rows never carry kahootMode (it's manual-editor-only), so a
// blank points cell always falls back to the non-kahoot default.
const DEFAULT_POINTS = 1;

const httpUrl = z.url({
  protocol: /^https?$/,
  error: 'Media URL must be a valid http(s) URL',
});

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

const baseFields = {
  round: z.string().min(1, 'Missing round name'),
  question: z.string().min(1, 'Missing question text'),
  answer: z.string().min(1, 'Missing answer'),
  notes: z.string().optional(),
  points: z
    .number('Points must be a positive whole number')
    .int('Points must be a positive whole number')
    .positive('Points must be a positive whole number'),
  break_after: z.enum(['', '0', '1'], {
    error: 'break_after must be "1", "0", or blank',
  }),
  // Always '' or a canonical ROUND_CATEGORIES value by the time it reaches
  // here — resolveCategoryCell already blanked out anything unrecognized.
  category: z.string(),
  author: z.string().optional(),
};

export const freeTextRowSchema = z.object({
  type: z.literal('free_text'),
  ...baseFields,
  media_url: httpUrl.optional(),
  answer_media_url: httpUrl.optional(),
});

export const multipleChoiceRowSchema = z
  .object({
    type: z.literal('multiple_choice'),
    ...baseFields,
    options: z
      .array(z.string(), 'Provide at least two pipe-separated options')
      .min(2, 'Provide at least two pipe-separated options'),
    media_url: httpUrl.optional(),
    answer_media_url: httpUrl.optional(),
  })
  .refine((row) => row.answer === '' || row.options.includes(row.answer), {
    path: ['answer'],
    error: 'Answer must be one of the options',
  });

export const audioRowSchema = z.object({
  type: z.literal('audio'),
  ...baseFields,
  media_url: httpUrl,
  answer_media_url: httpUrl.optional(),
});

export const youtubeRowSchema = z.object({
  type: z.literal('youtube'),
  ...baseFields,
  media_url: httpUrl.refine((url) => extractYoutubeVideoId(url) !== undefined, {
    error: 'media_url must be a youtube.com/youtu.be link for type youtube',
  }),
  answer_media_url: httpUrl.optional(),
});

export const closestGuessRowSchema = z.object({
  type: z.literal('closest_guess'),
  ...baseFields,
  answer: z
    .string()
    .refine((value) => value !== '' && Number.isFinite(Number(value)), {
      error: 'Answer must be a number',
    }),
  media_url: httpUrl.optional(),
  answer_media_url: httpUrl.optional(),
});

export const sortRowSchema = z
  .object({
    type: z.literal('sort'),
    ...baseFields,
    options: z
      .array(z.string(), 'Provide at least two pipe-separated items')
      .min(2, 'Provide at least two pipe-separated items'),
    media_url: httpUrl.optional(),
    answer_media_url: httpUrl.optional(),
  })
  .refine((row) => isSameMultiset(row.options, splitPipeList(row.answer)), {
    path: ['answer'],
    error:
      'Answer must list every option exactly once, in the correct order (pipe-separated)',
  });

export const matchRowSchema = z
  .object({
    type: z.literal('match'),
    ...baseFields,
    match_left: z
      .array(z.string(), 'Provide at least two pipe-separated left items')
      .min(2, 'Provide at least two pipe-separated left items'),
    match_right: z
      .array(z.string(), 'Provide at least two pipe-separated right items')
      .min(2, 'Provide at least two pipe-separated right items'),
    media_url: httpUrl.optional(),
    answer_media_url: httpUrl.optional(),
  })
  .refine((row) => row.match_left.length === row.match_right.length, {
    path: ['options'],
    error: 'Left and right lists must have the same number of items',
  })
  .refine(
    (row) =>
      toCanonicalMatchAnswer(row.answer, row.match_left, row.match_right) !==
      undefined,
    {
      path: ['answer'],
      error:
        'Answer must pair each left item with a right item, e.g. "left1+right1|left2+right2"',
    },
  );

export const questionRowSchema = z.discriminatedUnion('type', [
  freeTextRowSchema,
  multipleChoiceRowSchema,
  audioRowSchema,
  youtubeRowSchema,
  closestGuessRowSchema,
  sortRowSchema,
  matchRowSchema,
]);

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

/** Decodes a raw sheet row into the candidate object `questionRowSchema` validates. */
export function decodeSheetRow(row: SheetRow, type: QuestionType): unknown {
  const trimmedPoints = row.points.trim();
  const trimmedNotes = row.notes.trim();
  const matchOptions = splitMatchOptions(row.options);
  return {
    type,
    round: row.round.trim(),
    question: row.question.trim(),
    answer: row.answer.trim(),
    notes: trimmedNotes === '' ? undefined : trimmedNotes,
    points: trimmedPoints === '' ? DEFAULT_POINTS : Number(trimmedPoints),
    options: splitOptions(row.options),
    match_left: matchOptions.left,
    match_right: matchOptions.right,
    media_url: row.mediaUrl.trim() === '' ? undefined : row.mediaUrl.trim(),
    answer_media_url:
      row.answerMediaUrl.trim() === '' ? undefined : row.answerMediaUrl.trim(),
    break_after: row.breakAfter.trim(),
    category: resolveCategoryCell(row.category),
    author: row.author.trim() === '' ? undefined : row.author.trim(),
  };
}
