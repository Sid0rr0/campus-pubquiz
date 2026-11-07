import type { ImportRoundPreview } from './import';
import type { LiveEditFrontier } from './live-edit-frontier';
import type { QuizMode } from './quiz-mode';

/**
 * Full editable quiz — same round/question shape as `ImportRoundPreview`
 * (already carries type/prompt/answer/notes/points/options/mediaUrl), plus
 * the persisted quiz id/title. Returned by `GET /quizzes/:id` for the quiz
 * editor page to load an existing quiz into its draft state.
 */
export interface QuizDraft {
  id: number;
  title: string;
  /** Fixed at creation; the editor shows it read-only. */
  mode: QuizMode;
  rounds: ImportRoundPreview[];
  /** When the quiz last changed (ISO). The editor sends it back as `loadedUpdatedAt` so a save from an out-of-date copy is refused. */
  updatedAt: string;
  /** Present only when a session is currently live on this quiz — the editor uses it to lock opened questions and the rounds up to the current one against structural edits. Absent when no session is live, matching today's behavior exactly. */
  liveEdit?: LiveEditFrontier;
}

/** One validation problem found in a `QuizDraftSaveRequest`. `questionIndex` is null for round-level issues (e.g. a blank round title). */
export interface QuizDraftIssue {
  roundIndex: number;
  questionIndex: number | null;
  field: string;
  message: string;
}

/** Body shared by `POST /quizzes` (create) and `PUT /quizzes/:id` (update). */
export interface QuizDraftSaveRequest {
  title: string;
  /** A create stores it (absent means pub); an update refuses a value that differs from the stored quiz's, since the mode never changes. */
  mode?: QuizMode;
  rounds: ImportRoundPreview[];
  /** The `updatedAt` of the draft this save was made from. A save is refused (412) when the stored quiz has changed since. Left out by callers that don't edit a loaded copy. */
  loadedUpdatedAt?: string;
}

export interface QuizDraftSaveResult {
  quizId: number;
  roundCount: number;
  questionCount: number;
  /** The quiz's `updatedAt` after this save — the next save's `loadedUpdatedAt`. */
  updatedAt: string;
}
