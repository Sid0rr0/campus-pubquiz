import { z } from 'zod';
import type {
  ImportQuestionPreview,
  ImportRoundPreview,
  SheetRow,
} from './import';
import { QUESTION_KINDS, type QuestionIssue } from './question-kind';
import type { QuestionType } from './question-types';
import { ROUND_CATEGORIES } from './round-category';

/**
 * Sheet-row half of the CSV format, both directions. The question's own
 * options/answer cells are each kind's `csv` codec
 * (`QUESTION_KINDS[type].csv`), and the decoded question is validated by the
 * kind's schema; this file owns the columns every type shares, what only a
 * sheet row has (round name, break_after, category, author) and the mapping
 * of issue paths back to sheet column names.
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
  const { answerIssue, ...choices } = QUESTION_KINDS[type].csv.decode({
    options: row.options,
    answer: row.answer,
  });
  return {
    sheetAnswerIssue: answerIssue,
    meta: {
      round: row.round.trim(),
      break_after: row.breakAfter.trim(),
      category: resolveCategoryCell(row.category),
      author: blankToUndefined(row.author),
    },
    question: {
      type,
      prompt: row.question.trim(),
      ...choices,
      notes: blankToUndefined(row.notes),
      points: trimmedPoints === '' ? DEFAULT_POINTS : Number(trimmedPoints),
      mediaUrl: blankToUndefined(row.mediaUrl),
      answerMediaUrl: blankToUndefined(row.answerMediaUrl),
    },
  };
}

/**
 * Encodes one question of `round` as the sheet row `decodeSheetRow` reads
 * back as the same question. Round-level cells (break_after, category,
 * author) are written only on the round's last row — the importer lets any
 * row carry them, and the last is where authors conventionally put them.
 * Fields with no column (questionId, matchScoringMode, round kahootMode)
 * are not written.
 */
export function encodeSheetRow(
  round: Pick<
    ImportRoundPreview,
    'title' | 'breakAfter' | 'category' | 'author'
  >,
  question: ImportQuestionPreview,
  isLastInRound: boolean,
): Omit<SheetRow, 'rowNumber'> {
  const { options, answer } =
    QUESTION_KINDS[question.type].csv.encode(question);
  return {
    round: round.title,
    type: question.type,
    question: question.prompt,
    options,
    answer,
    points: String(question.points),
    mediaUrl: question.mediaUrl ?? '',
    answerMediaUrl: question.answerMediaUrl ?? '',
    notes: question.notes ?? '',
    breakAfter: isLastInRound && round.breakAfter ? '1' : '',
    category: isLastInRound ? (round.category ?? '') : '',
    author: isLastInRound ? (round.author ?? '') : '',
  };
}

function blankToUndefined(cell: string): string | undefined {
  const trimmed = cell.trim();
  return trimmed === '' ? undefined : trimmed;
}
