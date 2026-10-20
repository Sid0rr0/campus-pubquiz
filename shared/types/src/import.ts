/**
 * One data row of the imported sheet, raw cell strings as exported by the
 * Google Sheets CSV endpoint. `rowNumber` is 1-based and counts the header,
 * so the first data row is row 2 — matching what authors see in Sheets.
 */
export interface SheetRow {
  rowNumber: number;
  round: string;
  type: string;
  question: string;
  options: string;
  answer: string;
  points: string;
  mediaUrl: string;
  answerMediaUrl: string;
  notes: string;
  breakAfter: string;
  category: string;
  author: string;
  /** Round-level, like category and author: the `round_note` cell. */
  roundNote: string;
  /** Round-level: the `show_round_note` cell, '' / '0' / '1'. */
  showRoundNote: string;
}

export interface ImportRowIssue {
  rowNumber: number;
  field: string;
  message: string;
}

/**
 * What the quiz editor and import work with, inferred from the per-type
 * preview schemas' input shape (see `question-preview-schema.ts`); the field
 * docs live there. Re-exported here under its long-standing name.
 */
export type { ImportQuestionPreview } from './question-preview-schema';
import type { ImportQuestionPreview } from './question-preview-schema';

export interface ImportRoundPreview {
  title: string;
  breakAfter: boolean;
  /**
   * Kahoot mode — see RoundConfig.kahootMode. Only settable through the
   * manual quiz editor, never via CSV/Sheets import (there's no `kahoot_mode`
   * column), so a CSV-assembled round never sets this. Optional, like
   * breakAfter is required but this isn't, so the many existing
   * ImportRoundPreview literals across the test suite don't all need
   * updating; undefined behaves as false.
   */
  kahootMode?: boolean;
  /** Round topic/theme — one of ROUND_CATEGORIES, or unset. Shown on the big screen's round_intro/round_overview alongside the title. */
  category?: string;
  /** Who wrote this round's questions — optional, shown on the big screen's round_intro/round_overview alongside the title. */
  author?: string;
  /** What the quiz master says while this round's intro is on air — see Round.note. Blank is never stored: it is absent. */
  note?: string;
  /** Whether the note also shows on the big screen — see Round.showNoteOnScreen. Absent means off. */
  showNoteOnScreen?: boolean;
  questions: ImportQuestionPreview[];
}

export interface ImportPreview {
  quizTitle: string;
  rounds: ImportRoundPreview[];
  issues: ImportRowIssue[];
  isImportable: boolean;
}

/**
 * Request body shared by POST /import/preview and POST /import/confirm.
 * `csvText` is the content of an uploaded CSV file (e.g. a Google Sheets
 * "File → Download → CSV" export), read client-side and sent as text.
 * `joinCode` identifies which session's active quiz to check/reload against
 * — required by /import/confirm, ignored by /import/preview (which never
 * touches game state).
 */
export interface ImportRequest {
  csvText: string;
  quizTitle?: string;
  joinCode?: string;
}

/**
 * Request body shared by POST /import/preview-from-url and
 * POST /import/confirm-from-url. `sheetUrl` is a pasted Google Sheets link
 * (e.g. `https://docs.google.com/spreadsheets/d/{id}/edit`) fetched
 * server-side — see `sheet-url-fetcher.ts` for the SSRF-safe fetch. `joinCode`
 * is required by confirm-from-url, ignored by preview-from-url.
 */
export interface ImportFromUrlRequest {
  sheetUrl: string;
  quizTitle?: string;
  joinCode?: string;
}

export interface ImportConfirmResult {
  quizId: number;
  roundCount: number;
  questionCount: number;
}

export function createImportPreview(
  quizTitle: string,
  rounds: ImportRoundPreview[],
  issues: ImportRowIssue[],
): ImportPreview {
  const questionCount = rounds.reduce(
    (total, round) => total + round.questions.length,
    0,
  );
  return {
    quizTitle,
    rounds,
    issues,
    isImportable: issues.length === 0 && questionCount > 0,
  };
}
