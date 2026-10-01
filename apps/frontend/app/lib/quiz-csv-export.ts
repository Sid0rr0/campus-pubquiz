import {
  encodeSheetRow,
  type ImportQuestionPreview,
  type ImportRoundPreview,
} from '@campus-pubquiz/types';

/** Same columns, in the same order, as the CSV/Sheets import format — see the backend's sheet-csv.parser.ts. */
const CSV_HEADER = [
  'round',
  'type',
  'question',
  'options',
  'answer',
  'points',
  'media_url',
  'answer_media_url',
  'notes',
  'break_after',
  'category',
  'author',
];

/** Lets Excel read the file as UTF-8; the importer strips it (`bom: true`). */
const UTF8_BOM = '﻿';
const ROW_SEPARATOR = '\r\n';
const FALLBACK_FILENAME = 'quiz';

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** A sheet row's cells in CSV_HEADER order; each question's cells come from its kind (encodeSheetRow). */
function questionRow(
  round: ImportRoundPreview,
  question: ImportQuestionPreview,
  isLastInRound: boolean,
): string[] {
  const row = encodeSheetRow(round, question, isLastInRound);
  return [
    row.round,
    row.type,
    row.question,
    row.options,
    row.answer,
    row.points,
    row.mediaUrl,
    row.answerMediaUrl,
    row.notes,
    row.breakAfter,
    row.category,
    row.author,
  ];
}

/**
 * Serializes quiz rounds into the CSV format the importer reads, so an
 * exported file can be re-imported as-is. Rounds without questions have no
 * row to carry them and are omitted. Round `kahootMode` has no column and is
 * not exported.
 */
export function quizToCsv(rounds: readonly ImportRoundPreview[]): string {
  const rows = rounds.flatMap((round) =>
    round.questions.map((question, index) =>
      questionRow(round, question, index === round.questions.length - 1),
    ),
  );
  const lines = [CSV_HEADER, ...rows].map((row) =>
    row.map(escapeCell).join(','),
  );
  return `${UTF8_BOM}${lines.join(ROW_SEPARATOR)}`;
}

/** `Campus Pub Quiz #3` → `campus-pub-quiz-3.csv`. */
export function csvFilename(quizTitle: string): string {
  const slug = quizTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || FALLBACK_FILENAME}.csv`;
}
