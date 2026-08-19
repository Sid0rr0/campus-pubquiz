import { z } from 'zod';
import {
  createImportPreview,
  extractYoutubeVideoId,
  isSameMultiset,
  splitPipeList,
  type ImportPreview,
  type ImportQuestionPreview,
  type ImportRowIssue,
  type QuestionType,
  type SheetRow,
} from '@campus-pubquiz/types';

const QUESTION_TYPES: readonly QuestionType[] = [
  'free_text',
  'multiple_choice',
  'picture',
  'audio',
  'youtube',
  'sort',
  'match',
  'closest_guess',
];

const DEFAULT_POINTS = 1;

const httpUrl = z.url({
  protocol: /^https?$/,
  error: 'Media URL must be a valid http(s) URL',
});

// Schema keys use the sheet column names so Zod issue paths map straight to
// the ImportRowIssue.field the quiz author sees in the preview table.
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
};

const questionRowSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('free_text'),
    ...baseFields,
    media_url: httpUrl.optional(),
    answer_media_url: httpUrl.optional(),
  }),
  z
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
    }),
  z.object({
    type: z.literal('picture'),
    ...baseFields,
    media_url: httpUrl,
    answer_media_url: httpUrl.optional(),
  }),
  z.object({
    type: z.literal('audio'),
    ...baseFields,
    media_url: httpUrl,
    answer_media_url: httpUrl.optional(),
  }),
  z.object({
    type: z.literal('youtube'),
    ...baseFields,
    media_url: httpUrl.refine(
      (url) => extractYoutubeVideoId(url) !== undefined,
      {
        error: 'media_url must be a youtube.com/youtu.be link for type youtube',
      },
    ),
    answer_media_url: httpUrl.optional(),
  }),
  z.object({
    type: z.literal('closest_guess'),
    ...baseFields,
    answer: z
      .string()
      .refine((value) => value !== '' && Number.isFinite(Number(value)), {
        error: 'Answer must be a number',
      }),
    media_url: httpUrl.optional(),
    answer_media_url: httpUrl.optional(),
  }),
  z
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
    }),
  z
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
    ),
]);

export type ParsedQuestionRow =
  | {
      ok: true;
      roundTitle: string;
      roundBreakAfter: boolean;
      question: ImportQuestionPreview;
    }
  | { ok: false; issues: ImportRowIssue[] };

function normalizeType(rawType: string): string {
  return rawType
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
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

// A `match` row's `answer` cell lists correct pairs as `left+right`,
// pipe-separated, in any order (e.g. "arthur+excalibur|robin hood+bow").
// Reorders them into `left`'s order so the stored answer is directly
// comparable (by exact string equality) to a player's submitted value, which
// is built positionally the same way — see AnswerForm's match UI. Returns
// undefined if the pairs don't form a perfect one-to-one matching between
// `left` and `right`.
function toCanonicalMatchAnswer(
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

function toCandidate(row: SheetRow, type: QuestionType): unknown {
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
  };
}

/**
 * Validates one raw sheet row into a question preview, or the list of
 * per-field issues that block it. Never throws — broken rows become issues.
 */
export function parseQuestionRow(row: SheetRow): ParsedQuestionRow {
  const type = normalizeType(row.type);
  if (!(QUESTION_TYPES as readonly string[]).includes(type)) {
    return {
      ok: false,
      issues: [
        {
          rowNumber: row.rowNumber,
          field: 'type',
          message: `Unknown question type "${row.type.trim()}" — expected one of: ${QUESTION_TYPES.join(', ')}`,
        },
      ],
    };
  }

  const parsed = questionRowSchema.safeParse(
    toCandidate(row, type as QuestionType),
  );
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        rowNumber: row.rowNumber,
        field: String(issue.path[0] ?? 'row'),
        message: issue.message,
      })),
    };
  }

  const { round, question, notes, points, break_after } = parsed.data;
  const answer =
    parsed.data.type === 'sort'
      ? splitPipeList(parsed.data.answer).join('|')
      : parsed.data.type === 'match'
        ? toCanonicalMatchAnswer(
            parsed.data.answer,
            parsed.data.match_left,
            parsed.data.match_right,
          )!
        : parsed.data.answer;
  return {
    ok: true,
    roundTitle: round,
    roundBreakAfter: break_after === '1',
    question: {
      type: parsed.data.type,
      prompt: question,
      answer,
      ...(notes ? { notes } : {}),
      points,
      ...(parsed.data.type === 'multiple_choice' || parsed.data.type === 'sort'
        ? { options: parsed.data.options }
        : {}),
      ...(parsed.data.type === 'match'
        ? {
            options: parsed.data.match_left,
            matchTargets: parsed.data.match_right,
          }
        : {}),
      ...(parsed.data.media_url ? { mediaUrl: parsed.data.media_url } : {}),
      ...(parsed.data.answer_media_url
        ? { answerMediaUrl: parsed.data.answer_media_url }
        : {}),
    },
  };
}

/**
 * Groups validated rows into rounds by round name in order of first
 * appearance. A round breaks after itself if any of its rows has
 * break_after = "1"; blank/"0" rows don't grade a break on their own. The
 * state machine requires the final round to end in a grading break, so the
 * last round's break is always forced on regardless of its break_after
 * cells — authors don't need to remember to mark it.
 */
export function assembleImportPreview(
  quizTitle: string,
  rows: SheetRow[],
): ImportPreview {
  const issues: ImportRowIssue[] = [];
  const questionsByRound = new Map<string, ImportQuestionPreview[]>();
  const breakAfterByRound = new Map<string, boolean>();

  for (const row of rows) {
    const result = parseQuestionRow(row);
    if (!result.ok) {
      issues.push(...result.issues);
      continue;
    }
    const questions = questionsByRound.get(result.roundTitle) ?? [];
    questionsByRound.set(result.roundTitle, [...questions, result.question]);
    breakAfterByRound.set(
      result.roundTitle,
      (breakAfterByRound.get(result.roundTitle) ?? false) ||
        result.roundBreakAfter,
    );
  }

  const roundTitles = [...questionsByRound.keys()];
  const rounds = roundTitles.map((title, index) => ({
    title,
    breakAfter:
      index === roundTitles.length - 1
        ? true
        : (breakAfterByRound.get(title) ?? false),
    questions: questionsByRound.get(title) ?? [],
  }));

  return createImportPreview(quizTitle, rounds, issues);
}
