import {
  QUESTION_TYPES,
  createImportPreview,
  checkQuestion,
  decodeSheetRow,
  isQuickfireAllowedType,
  quickfireTypesMessage,
  sheetFieldForIssue,
  sheetRowMetaSchema,
  withDerivedPoints,
  type ImportPreview,
  type ImportQuestionPreview,
  type ImportRowIssue,
  type QuestionType,
  type QuizMode,
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

/** Why a row's type cell is refused (removed, unknown, or outside a quickfire quiz's list), or null when it is fine. */
function typeRefusal(
  rawType: string,
  type: string,
  mode: QuizMode,
): string | null {
  if (REMOVED_QUESTION_TYPES.includes(type)) {
    return `Question type "${rawType.trim()}" was removed — use free_text (or multiple_choice if the row has options) and keep the media_url.`;
  }
  if (!(QUESTION_TYPES as readonly string[]).includes(type)) {
    return `Unknown question type "${rawType.trim()}" — expected one of: ${QUESTION_TYPES.join(', ')}`;
  }
  return mode === 'quickfire' && !isQuickfireAllowedType(type as QuestionType)
    ? quickfireTypesMessage()
    : null;
}

/**
 * Validates one raw sheet row into a question preview, or the list of
 * per-field issues that block it. Never throws — broken rows become issues.
 */
export function parseQuestionRow(
  row: SheetRow,
  mode: QuizMode = 'pub',
): ParsedQuestionRow {
  const type = normalizeType(row.type);
  const typeMessage = typeRefusal(row.type, type, mode);
  if (typeMessage !== null) {
    return {
      ok: false,
      issues: [
        { rowNumber: row.rowNumber, field: 'type', message: typeMessage },
      ],
    };
  }

  const {
    meta,
    question: candidate,
    sheetAnswerIssue,
    clipIssues,
  } = decodeSheetRow(row, type as QuestionType, mode);
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
    question: withDerivedPoints(candidate as unknown as ImportQuestionPreview),
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
  mode: QuizMode = 'pub',
): ImportPreview {
  const issues: ImportRowIssue[] = [];
  const roundsByTitle = new Map<string, RoundCells>();
  for (const row of rows) {
    const result = parseQuestionRow(row, mode);
    if (result.ok) {
      addRowToRound(roundsByTitle, result);
    } else {
      issues.push(...result.issues);
    }
  }
  const titles = [...roundsByTitle.keys()];
  const rounds = titles.map((title, index) =>
    toRoundPreview(
      title,
      roundsByTitle.get(title)!,
      index === titles.length - 1,
    ),
  );
  return createImportPreview(quizTitle, rounds, issues);
}

/** One round's questions and round-level cells, each cell the first non-blank one seen. */
interface RoundCells {
  questions: ImportQuestionPreview[];
  breakAfter: boolean;
  category: string;
  author: string;
  note: string;
  showRoundNote: '' | '0' | '1';
}

function addRowToRound(
  roundsByTitle: Map<string, RoundCells>,
  row: Extract<ParsedQuestionRow, { ok: true }>,
): void {
  const round = roundsByTitle.get(row.roundTitle);
  if (!round) {
    roundsByTitle.set(row.roundTitle, {
      questions: [row.question],
      breakAfter: row.roundBreakAfter,
      category: row.roundCategory,
      author: row.roundAuthor,
      note: row.roundNote,
      showRoundNote: row.showRoundNote,
    });
    return;
  }
  round.questions.push(row.question);
  round.breakAfter ||= row.roundBreakAfter;
  round.category ||= row.roundCategory;
  round.author ||= row.roundAuthor;
  round.note ||= row.roundNote;
  round.showRoundNote ||= row.showRoundNote;
}

function toRoundPreview(
  title: string,
  round: RoundCells,
  isLastRound: boolean,
): ImportPreview['rounds'][number] {
  return {
    title,
    breakAfter: isLastRound || round.breakAfter,
    ...(round.category ? { category: round.category } : {}),
    ...(round.author ? { author: round.author } : {}),
    ...(round.note ? { note: round.note } : {}),
    // The setting means nothing without a note, so an empty note drops it.
    ...(round.note && round.showRoundNote === '1'
      ? { showNoteOnScreen: true }
      : {}),
    questions: round.questions,
  };
}
