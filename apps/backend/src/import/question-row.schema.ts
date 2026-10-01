import {
  QUESTION_TYPES,
  createImportPreview,
  decodeSheetRow,
  questionRowSchema,
  splitPipeList,
  toCanonicalMatchAnswer,
  type ImportPreview,
  type ImportQuestionPreview,
  type ImportRowIssue,
  type QuestionType,
  type SheetRow,
} from '@campus-pubquiz/types';

export type ParsedQuestionRow =
  | {
      ok: true;
      roundTitle: string;
      roundBreakAfter: boolean;
      /** Blank ('') when the row's category cell is empty. */
      roundCategory: string;
      /** Blank ('') when the row's author cell is empty. */
      roundAuthor: string;
      question: ImportQuestionPreview;
    }
  | { ok: false; issues: ImportRowIssue[] };

function normalizeType(rawType: string): string {
  return rawType
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
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
    decodeSheetRow(row, type as QuestionType),
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

  const { round, question, notes, points, break_after, category, author } =
    parsed.data;
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
    roundCategory: category ?? '',
    roundAuthor: author ?? '',
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
 * cells — authors don't need to remember to mark it. `category`/`author`
 * are round-level metadata too: the first non-blank cell seen for a round
 * wins, so authors only need to fill it in on one row (conventionally the
 * last, matching where `break_after` is put).
 */
export function assembleImportPreview(
  quizTitle: string,
  rows: SheetRow[],
): ImportPreview {
  const issues: ImportRowIssue[] = [];
  const questionsByRound = new Map<string, ImportQuestionPreview[]>();
  const breakAfterByRound = new Map<string, boolean>();
  const categoryByRound = new Map<string, string>();
  const authorByRound = new Map<string, string>();

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
    if (result.roundCategory && !categoryByRound.has(result.roundTitle)) {
      categoryByRound.set(result.roundTitle, result.roundCategory);
    }
    if (result.roundAuthor && !authorByRound.has(result.roundTitle)) {
      authorByRound.set(result.roundTitle, result.roundAuthor);
    }
  }

  const roundTitles = [...questionsByRound.keys()];
  const rounds = roundTitles.map((title, index) => ({
    title,
    breakAfter:
      index === roundTitles.length - 1
        ? true
        : (breakAfterByRound.get(title) ?? false),
    ...(categoryByRound.has(title)
      ? { category: categoryByRound.get(title) }
      : {}),
    ...(authorByRound.has(title) ? { author: authorByRound.get(title) } : {}),
    questions: questionsByRound.get(title) ?? [],
  }));

  return createImportPreview(quizTitle, rounds, issues);
}
