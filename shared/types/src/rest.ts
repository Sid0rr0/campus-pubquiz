import type { GameStatus } from './game-state';
import type { QuestionType } from './question-types';
import type { SessionSettings } from './session-settings';

export interface QuizSummaryQuestion {
  id: number;
  type: QuestionType;
  prompt: string;
  options?: string[];
  matchTargets?: string[];
  answer: string;
}

export interface QuizSummaryRound {
  title: string;
  breakAfter: boolean;
  /** See RoundConfig.kahootMode — optional so existing QuizSummaryRound literals don't all need updating; undefined behaves as false. */
  kahootMode?: boolean;
  questions: QuizSummaryQuestion[];
}

export interface QuizSummary {
  id: number;
  title: string;
  /** ISO timestamp of the quiz's last edit, for the /sessions "Edited" column. */
  updatedAt: string;
  rounds: QuizSummaryRound[];
}

export interface QuizzesListedPayload {
  /** The quiz the given joinCode's session is currently running, or null when no joinCode was provided. */
  activeQuizId: number | null;
  quizzes: QuizSummary[];
}

/** Request body for POST /sessions — start a new concurrent GameSession for a quiz. */
export interface CreateSessionPayload {
  quizId: number;
  /** Custom display name for the session. Blank or omitted falls back to the quiz's title. */
  name?: string;
  /** Any fields omitted are filled in from DEFAULT_SESSION_SETTINGS by the server. */
  settings?: Partial<SessionSettings>;
}

/** One running GameSession, as listed by GET /sessions for the admin session picker. */
export interface ActiveSessionSummary {
  joinCode: string;
  quizId: number;
  quizTitle: string;
  /** The session's display name — a custom name set at creation/rename, or quizTitle when none was set. */
  name: string;
  status: GameStatus;
  teamCount: number;
  /** ISO timestamp the session was created (POST /sessions), for the "Started" display. */
  startedAt: string;
}
