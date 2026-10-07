import type { AdminQuestionContext } from './room-views';
import type { Verdict } from './scoring';

export interface SubmitAnswerPayload {
  questionId: number;
  teamId: number;
  value: string;
}

/**
 * Sentinel `SubmitAnswerPayload.value` a team can submit instead of a real
 * answer, meaning "we don't know" rather than leaving the question
 * untouched. Still counts as a real submission everywhere a submitted
 * answer does — `answeredTeamIds`, the admin's per-team answer list, grading
 * — since no server-side code branches on it; only `formatAnswerValue`
 * (frontend) recognizes it, to render a friendly label instead of the raw
 * sentinel. Never equals a real correct answer, so it's auto-graded 0 for
 * multiple_choice/sort/match/closest_guess exactly like any other wrong
 * answer. A free_text answer is graded the same way (an exact, case-
 * insensitive match), so it's 0 too; audio/youtube fall to the admin.
 */
export const IDK_ANSWER_VALUE = '__idk__';

export interface AnswerReceivedPayload {
  questionId: number;
  teamId: number;
  teamName: string;
  value: string;
  /** Set when the answer is graded at submit (always for multiple_choice/sort/match, only on a match for free_text/audio/youtube); 0 for an answer waiting on admin grading until GRADE_ANSWER fires. */
  pointsAwarded: number;
  /** Set the instant an answer is graded at submit; null until the admin grades a free_text/audio/youtube answer that missed the key. */
  gradedAt: string | null;
  /** Set together with gradedAt; null until graded. */
  verdict: Verdict | null;
}

export interface TeamAnswerView {
  questionId: number;
  value: string;
  pointsAwarded: number;
  /** Set once this answer is graded (at submit when the answer is graded automatically, on admin grading otherwise) — the source of truth for "is this graded", since pointsAwarded defaults to 0 before grading. */
  gradedAt: string | null;
  /** Set together with gradedAt: how the answer was judged, independent of speed scaling or partial rounding. Null until graded. */
  verdict: Verdict | null;
}

export interface AnswerView {
  answerId: number;
  teamId: number;
  teamName: string;
  value: string;
  pointsAwarded: number;
  /** Set once the admin grades this answer — the source of truth for "is this graded", since pointsAwarded defaults to 0 before grading. */
  gradedAt: string | null;
  /** Set together with gradedAt — what "correct" means everywhere (a speed-scaled kahoot answer is still correct). Null until graded. */
  verdict: Verdict | null;
}

export interface AnswersUpdatedPayload {
  questionId: number;
  question: AdminQuestionContext;
  answers: AnswerView[];
}

export interface GradeAnswerPayload {
  answerId: number;
  pointsAwarded: number;
}

/**
 * Pushed to one team's own socket alone (never broadcast to a room) the
 * moment the block they answered reaches 'reveal_intro' — by then every
 * answer should already be graded (auto-graded at submit, or manually by
 * the admin sometime during the break screens beforehand), so this is the
 * one moment a still-connected team's local answers/points need refreshing
 * to be accurate once reveal renders them. Carries the team's complete
 * answer set for the session, same shape as JoinAcceptedPayload.answers.
 */
export interface TeamAnswersSyncedPayload {
  answers: TeamAnswerView[];
}
