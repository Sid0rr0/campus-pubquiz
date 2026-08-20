import type {
  GameAction,
  GameProgress,
  GameStatus,
  QuizStructureSummary,
} from './game-state';

export const SOCKET_EVENTS = {
  // server -> client
  STATE_SYNC: 'game:state_sync',
  STATE_UPDATED: 'game:state_updated',
  ANSWER_RECEIVED: 'game:answer_received',
  JOIN_ACCEPTED: 'game:join_accepted',
  ANSWERS_UPDATED: 'game:answers_updated',
  TEAM_ANSWERS_SYNCED: 'game:team_answers_synced',
  SESSION_CLOSED: 'game:session_closed',
  // client -> server
  ADMIN_ACTION: 'game:admin_action',
  SUBMIT_ANSWER: 'game:submit_answer',
  JOIN_PLAYERS: 'game:join_players',
  GRADE_ANSWER: 'game:grade_answer',
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

export type QuestionType =
  | 'free_text'
  | 'multiple_choice'
  | 'picture'
  | 'audio'
  | 'youtube'
  | 'sort'
  | 'match'
  | 'closest_guess';

export interface QuestionView {
  id: number;
  type: QuestionType;
  prompt: string;
  /**
   * Multiple choice: the choices. Sort: the items, in the order shown to
   * players (not necessarily correct — see RevealQuestionView.answer for
   * that). Match: the left-hand items, paired positionally with `answer` at
   * reveal (left[i] pairs with answer.split('|')[i]).
   */
  options?: string[];
  /** Match only: the right-hand items, in the order shown to players. */
  matchTargets?: string[];
  mediaUrl?: string;
  /** Clip range (seconds) into a YouTube mediaUrl — derived from the question's notes, ignored for non-YouTube media. */
  mediaStartSeconds?: number;
  mediaEndSeconds?: number;
  points: number;
}

export interface RevealQuestionView extends QuestionView {
  answer: string;
  /** Shown alongside the answer during reveal only — never sent before the question is revealed. */
  answerMediaUrl?: string;
  /** closest_guess only — undefined for every other type. */
  closestGuess?: ClosestGuessRevealData;
}

/**
 * closest_guess only — numeric-guess stats for the cumulative reveal sequence.
 * Present on RevealQuestionView only when the question's type is
 * 'closest_guess'; undefined for every other type.
 */
export interface ClosestGuessRevealData {
  /** False when zero teams submitted a guess — reveal collapses to the correct-answer step only. */
  hasSubmissions: boolean;
  /** Smallest submitted guess (step 1), as a string — undefined when !hasSubmissions. */
  minGuess?: string;
  /** Highest submitted guess (step 2) — undefined when !hasSubmissions. */
  maxGuess?: string;
  /**
   * Team(s) tied for closest (step 4), each with their OWN guessed value —
   * ties can be asymmetric (e.g. correct=100, guesses of 90 and 110 are
   * equally close but not equal), so this is not a single shared value.
   * Empty when !hasSubmissions.
   */
  closestGuesses: { teamName: string; value: string }[];
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

export type BlockQuestionView = QuestionView &
  QuestionPosition &
  QuestionRoundTitle;
export type BlockRevealQuestionView = RevealQuestionView &
  QuestionPosition &
  QuestionRoundTitle;

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
  /**
   * IDs of current-block questions (from `blockQuestions`) that still have
   * at least one submitted answer with `gradedAt === null` — closest_guess
   * excluded, since it grades itself automatically and never needs an admin
   * to act. Drives the "not yet graded" dot in the admin question browser;
   * ADVANCE out of the break/grading screens is rejected server-side while
   * this is non-empty.
   */
  ungradedQuestionIds: number[];
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
  /**
   * closest_guess only — which reveal sub-step (0-indexed) is shown for the
   * question currently at revealIndex. Ephemeral, like leaderboardRevealCount:
   * not part of GameProgress, not persisted, meaningless for every other
   * status/type. 0 whenever the current reveal question isn't closest_guess.
   */
  closestGuessRevealStep: number;
  /** This session's configurable settings — see SessionSettings. */
  settings: SessionSettings;
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
  /** Set for auto-graded types (multiple_choice/sort/match), graded the instant they're submitted; 0 for types that need admin grading (free_text/picture/audio) until GRADE_ANSWER fires. */
  pointsAwarded: number;
  /** Set the instant auto-graded types are submitted; null until the admin grades a free_text/picture/audio answer. */
  gradedAt: string | null;
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
  pointsAwarded: number;
  /** Set once this answer is graded (instantly for auto-graded types, on admin grading for the rest) — the source of truth for "is this graded", since pointsAwarded defaults to 0 before grading. */
  gradedAt: string | null;
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
  matchTargets?: string[];
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
  questions: QuizSummaryQuestion[];
}

export interface QuizSummary {
  id: number;
  title: string;
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
  /** Any fields omitted are filled in from DEFAULT_SESSION_SETTINGS by the server. */
  settings?: Partial<SessionSettings>;
}

/** One running GameSession, as listed by GET /sessions for the admin session picker. */
export interface ActiveSessionSummary {
  joinCode: string;
  quizId: number;
  quizTitle: string;
  status: GameStatus;
  teamCount: number;
}

export interface KickTeamPayload {
  teamId: number;
}

/** "shot"/"selfie" are the predefined quick-award categories; "custom" requires a `reason`. */
export type BonusCategory = 'shot' | 'selfie' | 'custom';

export const BONUS_CATEGORIES: readonly BonusCategory[] = [
  'shot',
  'selfie',
  'custom',
];

/** Per-session configuration, set at creation and editable in the lobby before START_QUIZ. */
export interface SessionSettings {
  /** Replaces the hardcoded 60s post-block auto-lock grace period. */
  lockGraceSeconds: number;
  /** Subset of BONUS_CATEGORIES the admin may award during this session. */
  enabledBonusCategories: BonusCategory[];
  /** Controls <audio autoPlay> and YouTube's autoplay=1 on /display. */
  autoplayMedia: boolean;
  /** One entry per rendered /rules bullet line — display text only, no enforcement. */
  rules: string[];
}

// Frozen (including its two array fields) so no code path can ever mutate
// this shared singleton in place: every session created with default
// settings (GameSession's entity default, SeedService.createSession's
// default param, resolveSessionSettings) holds this exact reference until
// something explicitly overrides it, so an accidental .push()/.splice()
// here would silently corrupt every other session's rules/categories for
// the life of the process. Spreading/mapping/filtering — the only
// operations any call site actually performs — all still work unchanged.
export const DEFAULT_SESSION_SETTINGS: SessionSettings = Object.freeze({
  lockGraceSeconds: 60,
  enabledBonusCategories: Object.freeze([
    ...BONUS_CATEGORIES,
  ]) as BonusCategory[],
  autoplayMedia: true,
  rules: Object.freeze([
    'Max 6 players per team — every additional player costs the team −2 points.',
    'No cheating.',
    'Please write your answers in English (Czech and Slovak also accepted if necessary).',
    'In case of disagreements, the organizers have the final word.',
    'Want to contest something? Come with a credible source.',
  ]) as string[],
});

export interface AwardBonusPayload {
  teamId: number;
  category: BonusCategory;
  /** Free-text reason, required for category "custom", ignored otherwise. */
  reason?: string;
  points: number;
}

/** Broadcast to a session's players room once its admin closes it — the session no longer exists server-side, so the client should drop its identity and return to the join screen. */
export interface SessionClosedPayload {
  joinCode: string;
}
