import {
  QUESTION_TYPES,
  createImportPreview,
  checkQuestion,
  decodeSheetRow,
  sheetFieldForIssue,
  sheetRowMetaSchema,
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

  const {
    meta,
    question: candidate,
    sheetAnswerIssue,
  } = decodeSheetRow(row, type as QuestionType);
  const parsedMeta = sheetRowMetaSchema.safeParse(meta);
  const checkedQuestion = checkQuestion(candidate);
  // Only when the schema passed: a failing pairing is already reported there.
  const questionIssues = checkedQuestion.success
    ? sheetAnswerIssue
      ? [sheetAnswerIssue]
      : []
    : checkedQuestion.issues;
  if (!parsedMeta.success || questionIssues.length > 0) {
    const issues = [
      ...(parsedMeta.success
        ? []
        : parsedMeta.error.issues.map(({ path, code, message }) => ({
            path,
            code,
            message,
          }))),
      ...questionIssues,
    ];
    return {
      ok: false,
      issues: issues.map((issue) => ({
        rowNumber: row.rowNumber,
        field: sheetFieldForIssue(issue),
        message: issue.message,
      })),
    };
  }

  const { round, break_after, category, author } = parsedMeta.data;
  return {
    ok: true,
    roundTitle: round,
    roundBreakAfter: break_after === '1',
    roundCategory: category,
    roundAuthor: author ?? '',
    question: (checkedQuestion as { data: unknown })
      .data as ImportQuestionPreview,
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
