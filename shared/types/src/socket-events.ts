import type { GameAction, GameProgress, QuizStructureSummary } from './game-state';

export const SOCKET_EVENTS = {
  // server -> client
  STATE_SYNC: 'game:state_sync',
  STATE_UPDATED: 'game:state_updated',
  ANSWER_RECEIVED: 'game:answer_received',
  JOIN_ACCEPTED: 'game:join_accepted',
  ANSWERS_UPDATED: 'game:answers_updated',
  QUIZZES_LISTED: 'game:quizzes_listed',
  // client -> server
  ADMIN_ACTION: 'game:admin_action',
  SUBMIT_ANSWER: 'game:submit_answer',
  JOIN_PLAYERS: 'game:join_players',
  GRADE_ANSWER: 'game:grade_answer',
  LIST_QUIZZES: 'game:list_quizzes',
  SELECT_QUIZ: 'game:select_quiz',
  LIST_ANSWERS: 'game:list_answers',
} as const;

export const SOCKET_ROOMS = {
  DISPLAY: 'display',
  ADMIN: 'admin',
  PLAYERS: 'players',
} as const;

export type QuestionType = 'free_text' | 'multiple_choice' | 'picture' | 'audio';

export interface QuestionView {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  mediaUrl?: string;
  points: number;
}

export interface RevealQuestionView extends QuestionView {
  answer: string;
}

export interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  totalPoints: number;
}

export interface TeamView {
  teamId: string;
  teamName: string;
}

export interface StateSnapshotPayload {
  progress: GameProgress;
  quizStructure: QuizStructureSummary;
  currentQuestion: QuestionView | null;
  /**
   * Questions open for (re-)answering: everything revealed so far in the
   * current block while a question is open, or the whole just-locked block
   * during break/reveal (for grading). Empty otherwise.
   */
  blockQuestions: QuestionView[];
  /** The just-finished block's questions with correct answers, shown during reveal. Empty otherwise. */
  revealQuestions: RevealQuestionView[];
  /** Teams that have answered the current question. Empty when none is open. */
  answeredTeamIds: string[];
  leaderboard: LeaderboardEntry[];
  joinCode: string;
  teams: TeamView[];
}

export interface AdminActionPayload {
  action: GameAction;
}

export interface SubmitAnswerPayload {
  questionId: string;
  teamId: string;
  value: string;
}

export interface AnswerReceivedPayload {
  questionId: string;
  teamId: string;
  teamName: string;
  value: string;
}

export interface JoinPlayersPayload {
  teamName: string;
  teamToken?: string;
  teamCode?: string;
  joinCode?: string;
}

export interface TeamAnswerView {
  questionId: string;
  value: string;
}

export interface JoinAcceptedPayload {
  teamId: string;
  teamToken: string;
  teamCode: string;
  teamName: string;
  /** The team's saved answers in this session, so reconnects restore them. */
  answers: TeamAnswerView[];
}

export interface AnswerView {
  answerId: string;
  teamId: string;
  teamName: string;
  value: string;
  pointsAwarded: number | null;
}

export interface AnswersUpdatedPayload {
  questionId: string;
  answers: AnswerView[];
}

export interface GradeAnswerPayload {
  answerId: string;
  pointsAwarded: number;
}

export interface QuizSummaryQuestion {
  id: string;
  prompt: string;
  options?: string[];
  answer: string;
}

export interface QuizSummaryRound {
  title: string;
  breakAfter: boolean;
  questions: QuizSummaryQuestion[];
}

export interface QuizSummary {
  id: string;
  title: string;
  rounds: QuizSummaryRound[];
}

export interface QuizzesListedPayload {
  activeQuizId: string;
  quizzes: QuizSummary[];
}

export interface SelectQuizPayload {
  quizId: string;
}

export interface ListAnswersPayload {
  questionId: string;
}
