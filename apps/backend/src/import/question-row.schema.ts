import { z } from 'zod';
import {
  createImportPreview,
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
  points: z
    .number('Points must be a positive whole number')
    .int('Points must be a positive whole number')
    .positive('Points must be a positive whole number'),
};

const questionRowSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('free_text'),
    ...baseFields,
    media_url: httpUrl.optional(),
  }),
  z
    .object({
      type: z.literal('multiple_choice'),
      ...baseFields,
      options: z
        .array(z.string(), 'Provide at least two pipe-separated options')
        .min(2, 'Provide at least two pipe-separated options'),
      media_url: httpUrl.optional(),
    })
    .refine((row) => row.answer === '' || row.options.includes(row.answer), {
      path: ['answer'],
      error: 'Answer must be one of the options',
    }),
  z.object({
    type: z.literal('picture'),
    ...baseFields,
    media_url: httpUrl,
  }),
  z.object({
    type: z.literal('audio'),
    ...baseFields,
    media_url: httpUrl,
  }),
]);

export type ParsedQuestionRow =
  | { ok: true; roundTitle: string; question: ImportQuestionPreview }
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

function toCandidate(row: SheetRow, type: QuestionType): unknown {
  const trimmedPoints = row.points.trim();
  return {
    type,
    round: row.round.trim(),
    question: row.question.trim(),
    answer: row.answer.trim(),
    points: trimmedPoints === '' ? DEFAULT_POINTS : Number(trimmedPoints),
    options: splitOptions(row.options),
    media_url: row.mediaUrl.trim() === '' ? undefined : row.mediaUrl.trim(),
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

  const { round, question, answer, points } = parsed.data;
  return {
    ok: true,
    roundTitle: round,
    question: {
      type: parsed.data.type,
      prompt: question,
      answer,
      points,
      ...(parsed.data.type === 'multiple_choice'
        ? { options: parsed.data.options }
        : {}),
      ...(parsed.data.media_url ? { mediaUrl: parsed.data.media_url } : {}),
    },
  };
}

/**
 * Groups validated rows into rounds by round name in order of first
 * appearance. Every imported round grades after itself (breakAfter: true) —
 * the classic pub-quiz rhythm — which also satisfies the state machine
 * invariant that the final round must end in a grading break.
 */
export function assembleImportPreview(
  quizTitle: string,
  rows: SheetRow[],
): ImportPreview {
  const issues: ImportRowIssue[] = [];
  const questionsByRound = new Map<string, ImportQuestionPreview[]>();

  for (const row of rows) {
    const result = parseQuestionRow(row);
    if (!result.ok) {
      issues.push(...result.issues);
      continue;
    }
    const questions = questionsByRound.get(result.roundTitle) ?? [];
    questionsByRound.set(result.roundTitle, [...questions, result.question]);
  }

  const rounds = [...questionsByRound.entries()].map(([title, questions]) => ({
    title,
    breakAfter: true,
    questions,
  }));
  return createImportPreview(quizTitle, rounds, issues);
}
