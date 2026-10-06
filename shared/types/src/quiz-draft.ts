import type { ImportRoundPreview } from './import';
import type { LiveEditFrontier } from './live-edit-frontier';

/**
 * Full editable quiz — same round/question shape as `ImportRoundPreview`
 * (already carries type/prompt/answer/notes/points/options/mediaUrl), plus
 * the persisted quiz id/title. Returned by `GET /quizzes/:id` for the quiz
 * editor page to load an existing quiz into its draft state.
 */
export interface QuizDraft {
  id: number;
  title: string;
  rounds: ImportRoundPreview[];
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
  rounds: ImportRoundPreview[];
}

export interface QuizDraftSaveResult {
  quizId: number;
  roundCount: number;
  questionCount: number;
}
