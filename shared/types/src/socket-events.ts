import type { GameAction, GameProgress } from './game-state';

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

export interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  totalPoints: number;
}

export interface StateSnapshotPayload {
  progress: GameProgress;
  currentQuestion: QuestionView | null;
  leaderboard: LeaderboardEntry[];
  joinCode: string;
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
  joinCode?: string;
}

export interface JoinAcceptedPayload {
  teamId: string;
  teamToken: string;
  teamName: string;
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

export interface QuizSummary {
  id: string;
  title: string;
}

export interface QuizzesListedPayload {
  activeQuizId: string;
  quizzes: QuizSummary[];
}

export interface SelectQuizPayload {
  quizId: string;
}
