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
      /** Blank ('') when the row's round_note cell is empty. */
      roundNote: string;
      /** Blank ('') when the row's show_round_note cell is empty. */
      showRoundNote: '' | '0' | '1';
      question: ImportQuestionPreview;
    }
  | { ok: false; issues: ImportRowIssue[] };

/** Types that used to exist: media is now carried by any question, so a row naming one gets a pointer to the replacement. */
const REMOVED_QUESTION_TYPES: readonly string[] = ['audio', 'youtube'];

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
  if (REMOVED_QUESTION_TYPES.includes(type)) {
    return {
      ok: false,
      issues: [
        {
          rowNumber: row.rowNumber,
          field: 'type',
          message: `Question type "${row.type.trim()}" was removed — use free_text (or multiple_choice if the row has options) and keep the media_url.`,
        },
      ],
    };
  }
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
    clipIssues,
  } = decodeSheetRow(row, type as QuestionType);
  const parsedMeta = sheetRowMetaSchema.safeParse(meta);
  const checkedQuestion = checkQuestion(candidate);
  // The answer issue only when the schema passed: a failing pairing is already
  // reported there. Clip issues are never in the schema's sight, so always.
  const questionIssues = [
    ...(checkedQuestion.success
      ? sheetAnswerIssue
        ? [sheetAnswerIssue]
        : []
      : checkedQuestion.issues),
    ...clipIssues,
  ];
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

  const { round, break_after, category, author, round_note, show_round_note } =
    parsedMeta.data;
  return {
    ok: true,
    roundTitle: round,
    roundBreakAfter: break_after === '1',
    roundCategory: category,
    roundAuthor: author ?? '',
    roundNote: round_note ?? '',
    showRoundNote: show_round_note,
    // The validated input, never the schema's parsed output (see checkQuestion).
    question: candidate as unknown as ImportQuestionPreview,
  };
}

/**
 * Groups validated rows into rounds by round name in order of first
 * appearance. A round breaks after itself if any of its rows has
 * break_after = "1"; blank/"0" rows don't grade a break on their own. The
 * state machine requires the final round to end in a grading break, so the
 * last round's break is always forced on regardless of its break_after
 * cells — authors don't need to remember to mark it. `category`/`author`/
 * `round_note`/`show_round_note` are round-level metadata too: the first non-blank cell seen for a round
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
  const noteByRound = new Map<string, string>();
  const showNoteByRound = new Map<string, boolean>();

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
    if (result.roundNote && !noteByRound.has(result.roundTitle)) {
      noteByRound.set(result.roundTitle, result.roundNote);
    }
    if (result.showRoundNote && !showNoteByRound.has(result.roundTitle)) {
      showNoteByRound.set(result.roundTitle, result.showRoundNote === '1');
    }
  }

  const roundTitles = [...questionsByRound.keys()];
  const rounds = roundTitles.map((title, index) => ({
    title,
    breakAfter:
      index === roundTitles.length - 1
        ? true
        : // Stryker disable next-line BooleanLiteral: equivalent, every round title in questionsByRound has a breakAfterByRound entry, so the fallback is never read
          (breakAfterByRound.get(title) ?? false),
    ...(categoryByRound.has(title)
      ? { category: categoryByRound.get(title) }
      : {}),
    ...(authorByRound.has(title) ? { author: authorByRound.get(title) } : {}),
    ...(noteByRound.has(title) ? { note: noteByRound.get(title) } : {}),
    // The setting means nothing without a note, so an empty note drops it.
    ...(noteByRound.has(title) && showNoteByRound.get(title)
      ? { showNoteOnScreen: true }
      : {}),
    questions: questionsByRound.get(title) ?? [],
  }));

  return createImportPreview(quizTitle, rounds, issues);
}
