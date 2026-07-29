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
  KICK_TEAM: 'game:kick_team',
} as const;

export const SOCKET_ROOMS = {
  DISPLAY: 'display',
  ADMIN: 'admin',
  PLAYERS: 'players',
} as const;

export type QuestionType = 'free_text' | 'multiple_choice' | 'picture' | 'audio';

export interface QuestionView {
  id: number;
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
  teamId: number;
  teamName: string;
  totalPoints: number;
}

export interface TeamView {
  teamId: number;
  teamName: string;
  isConnected: boolean;
}

export interface StateSnapshotPayload {
  progress: GameProgress;
  quizStructure: QuizStructureSummary;
  /** Title of the round at `progress.roundIndex` — shown big on the round_intro screen. */
  roundTitle: string;
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
  answeredTeamIds: number[];
  leaderboard: LeaderboardEntry[];
  joinCode: string;
  teams: TeamView[];
}

export interface AdminActionPayload {
  action: GameAction;
}

export interface SubmitAnswerPayload {
  questionId: number;
  teamId: number;
  value: string;
}

export interface AnswerReceivedPayload {
  questionId: number;
  teamId: number;
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
  questionId: number;
  value: string;
}

export interface JoinAcceptedPayload {
  teamId: number;
  teamToken: string;
  teamCode: string;
  teamName: string;
  /** The team's saved answers in this session, so reconnects restore them. */
  answers: TeamAnswerView[];
}

export interface AnswerView {
  answerId: number;
  teamId: number;
  teamName: string;
  value: string;
  pointsAwarded: number;
  /** Set once the admin grades this answer — the source of truth for "is this graded", since pointsAwarded defaults to 0 before grading. */
  gradedAt: string | null;
}

/**
 * Question context for the admin grading view — includes the correct answer
 * and round position. Only ever sent over ANSWERS_UPDATED, which is emitted
 * to the admin room alone; players and the display must never receive it.
 */
export interface AdminQuestionContext {
  type: QuestionType;
  prompt: string;
  options?: string[];
  mediaUrl?: string;
  points: number;
  correctAnswer: string;
  roundTitle: string;
  /** 1-based position of this question's round within the quiz. */
  roundNumber: number;
  /** 1-based position of this question within its round. */
  questionNumberInRound: number;
  totalQuestionsInRound: number;
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

export interface QuizSummaryQuestion {
  id: number;
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
  id: number;
  title: string;
  rounds: QuizSummaryRound[];
}

export interface QuizzesListedPayload {
  activeQuizId: number;
  quizzes: QuizSummary[];
}

export interface SelectQuizPayload {
  quizId: number;
}

export interface ListAnswersPayload {
  questionId: number;
}

export interface KickTeamPayload {
  teamId: number;
}
