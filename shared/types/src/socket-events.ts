import type { GameAction, GameProgress, GameStatus, QuizStructureSummary } from './game-state';

export const SOCKET_EVENTS = {
  // server -> client
  STATE_SYNC: 'game:state_sync',
  STATE_UPDATED: 'game:state_updated',
  ANSWER_RECEIVED: 'game:answer_received',
  JOIN_ACCEPTED: 'game:join_accepted',
  ANSWERS_UPDATED: 'game:answers_updated',
  // client -> server
  ADMIN_ACTION: 'game:admin_action',
  SUBMIT_ANSWER: 'game:submit_answer',
  JOIN_PLAYERS: 'game:join_players',
  GRADE_ANSWER: 'game:grade_answer',
  SELECT_QUIZ: 'game:select_quiz',
  LIST_ANSWERS: 'game:list_answers',
  KICK_TEAM: 'game:kick_team',
  AWARD_BONUS: 'game:award_bonus',
} as const;

export const SOCKET_ROOMS = {
  DISPLAY: 'display',
  ADMIN: 'admin',
  PLAYERS: 'players',
} as const;

export type SocketRoomName = (typeof SOCKET_ROOMS)[keyof typeof SOCKET_ROOMS];

/**
 * Socket.IO handshake `query` contract. `code` is optional so today's
 * single-session handshake (no code) keeps working unchanged; once a client
 * knows its session's joinCode it passes it here to be routed to that
 * session's rooms instead of the sole implicit one.
 */
export interface GameSocketHandshakeQuery {
  role: SocketRoomName;
  code?: string;
}

/** Room name for one role within one session — keeps the `${role}:${code}` naming convention in one place. */
export function sessionRoom(code: string, role: SocketRoomName): string {
  return `${role}:${code}`;
}

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
  /** Shown alongside the answer during reveal only — never sent before the question is revealed. */
  answerMediaUrl?: string;
}

/** Where a question sits in the quiz, for headers on the block/reveal/break screens. */
export interface QuestionPosition {
  /** 1-based position of this question's round within the quiz. */
  roundNumber: number;
  /** 1-based position of this question within its round. */
  questionNumberInRound: number;
}

/** Title of the round a block/reveal question belongs to — a block can span multiple rounds, so this is carried per-question rather than once per snapshot. */
export interface QuestionRoundTitle {
  roundTitle: string;
}

export type BlockQuestionView = QuestionView & QuestionPosition & QuestionRoundTitle;
export type BlockRevealQuestionView = RevealQuestionView & QuestionPosition & QuestionRoundTitle;

export interface RoundPoints {
  roundTitle: string;
  points: number;
}

export interface LeaderboardEntry {
  teamId: number;
  teamName: string;
  totalPoints: number;
  /** Sum of this team's bonus awards, already included in totalPoints — shown separately as a badge. */
  bonusPoints: number;
  /**
   * Points earned per round of the session's active quiz, in round order.
   * Answers graded under a since-replaced quiz's rounds are still folded
   * into totalPoints but won't appear here (their round no longer belongs
   * to the session's current quiz).
   */
  roundPoints: RoundPoints[];
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
  blockQuestions: BlockQuestionView[];
  /**
   * Positions of the current round's remaining questions — not open yet,
   * shown as disabled slots in the block picker so the whole round's shape
   * is visible up front. Empty unless a question is open/locking.
   */
  upcomingQuestions: QuestionPosition[];
  /** The just-finished block's questions with correct answers, shown during reveal. Empty otherwise. */
  revealQuestions: BlockRevealQuestionView[];
  /** Teams that have answered the current question. Empty when none is open. */
  answeredTeamIds: number[];
  leaderboard: LeaderboardEntry[];
  /**
   * How many teams (counting up from last place) are currently revealed on
   * the leaderboard, driven by REVEAL_NEXT_TEAM / ADVANCE while the board is
   * up. Ephemeral — resets to 0 whenever TOGGLE_LEADERBOARD fires.
   */
  leaderboardRevealCount: number;
  joinCode: string;
  teams: TeamView[];
  /** Epoch-ms deadline when the current (last-of-round) question auto-locks, or null if no lock is armed. */
  questionLockAt: number | null;
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

/** Request body for POST /sessions — start a new concurrent GameSession for a quiz. */
export interface CreateSessionPayload {
  quizId: number;
}

/** One running GameSession, as listed by GET /sessions for the admin session picker. */
export interface ActiveSessionSummary {
  joinCode: string;
  quizId: number;
  quizTitle: string;
  status: GameStatus;
  teamCount: number;
}

export interface ListAnswersPayload {
  questionId: number;
}

export interface KickTeamPayload {
  teamId: number;
}

/** "shot"/"selfie" are the predefined quick-award categories; "custom" requires a `reason`. */
export type BonusCategory = 'shot' | 'selfie' | 'custom';

export interface AwardBonusPayload {
  teamId: number;
  category: BonusCategory;
  /** Free-text reason, required for category "custom", ignored otherwise. */
  reason?: string;
  points: number;
}
