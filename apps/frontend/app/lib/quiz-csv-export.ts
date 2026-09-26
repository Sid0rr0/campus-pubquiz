import {
  splitPipeList,
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
const LIST_SEPARATOR = '|';
const PAIR_SEPARATOR = '+';
const FALLBACK_FILENAME = 'quiz';

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** `match` packs both lists into one cell — `left1|left2+right1|right2` — see splitMatchOptions in the backend's question-row.schema.ts. */
function optionsCell(question: ImportQuestionPreview): string {
  const options = (question.options ?? []).join(LIST_SEPARATOR);
  if (question.type !== 'match') return options;
  const targets = (question.matchTargets ?? []).join(LIST_SEPARATOR);
  return `${options}${PAIR_SEPARATOR}${targets}`;
}

/** A stored `match` answer lists just the right item for each left item, in left order; the CSV wants explicit `left+right` pairs. */
function answerCell(question: ImportQuestionPreview): string {
  if (question.type !== 'match') return question.answer;
  const rightItems = splitPipeList(question.answer);
  return (question.options ?? [])
    .map((left, index) => `${left}${PAIR_SEPARATOR}${rightItems[index] ?? ''}`)
    .join(LIST_SEPARATOR);
}

function questionRow(
  round: ImportRoundPreview,
  question: ImportQuestionPreview,
  isLastInRound: boolean,
): string[] {
  return [
    round.title,
    question.type,
    question.prompt,
    optionsCell(question),
    answerCell(question),
    String(question.points),
    question.mediaUrl ?? '',
    question.answerMediaUrl ?? '',
    question.notes ?? '',
    // A round breaks once any of its rows says so; the last row is where
    // authors conventionally put it (see sample-quiz-import.csv).
    isLastInRound && round.breakAfter ? '1' : '',
    // category/author are round-level metadata; only the last row carries
    // them, matching break_after's convention and the importer's "first
    // non-blank cell wins" grouping.
    isLastInRound ? (round.category ?? '') : '',
    isLastInRound ? (round.author ?? '') : '',
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
