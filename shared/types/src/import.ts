import type { QuestionType } from './socket-events';

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
}

export interface ImportRowIssue {
  rowNumber: number;
  field: string;
  message: string;
}

export interface ImportQuestionPreview {
  type: QuestionType;
  prompt: string;
  answer: string;
  notes?: string;
  points: number;
  options?: string[];
  mediaUrl?: string;
  /** Shown alongside the correct answer during reveal — independent of the question's own media_url. */
  answerMediaUrl?: string;
}

export interface ImportRoundPreview {
  title: string;
  breakAfter: boolean;
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
 */
export interface ImportRequest {
  csvText: string;
  quizTitle?: string;
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
