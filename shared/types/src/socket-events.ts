import type {
  AdminIndicators,
  HeaderContent,
  OnAirScreen,
  PlayersScreenFields,
} from './on-air-screen';
import type {
  GameAction,
  GameProgress,
  GameStatus,
  QuizStructureSummary,
} from './game-state';
import type { Verdict } from './scoring';

export const SOCKET_EVENTS = {
  // server -> client
  STATE_SYNC: 'game:state_sync',
  STATE_UPDATED: 'game:state_updated',
  ANSWER_RECEIVED: 'game:answer_received',
  JOIN_ACCEPTED: 'game:join_accepted',
  ANSWERS_UPDATED: 'game:answers_updated',
  PRESENTER_CONTEXT_UPDATED: 'game:presenter_context_updated',
  TEAM_ANSWERS_SYNCED: 'game:team_answers_synced',
  BONUS_AWARDED: 'game:bonus_awarded',
  SESSION_CLOSED: 'game:session_closed',
  TEAM_KICKED: 'game:team_kicked',
  // client -> server
  ADMIN_ACTION: 'game:admin_action',
  SUBMIT_ANSWER: 'game:submit_answer',
  JOIN_PLAYERS: 'game:join_players',
  GRADE_ANSWER: 'game:grade_answer',
  KICK_TEAM: 'game:kick_team',
  LEAVE_SESSION: 'game:leave_session',
  AWARD_BONUS: 'game:award_bonus',
  SET_BREAK_END_TIME: 'game:set_break_end_time',
  SET_DISPLAY_TEXT_SCALE: 'game:set_display_text_scale',
  CREATE_SHOWDOWN_ROUND: 'game:create_showdown_round',
  SUBMIT_SHOWDOWN_GUESS: 'game:submit_showdown_guess',
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
  | 'audio'
  | 'youtube'
  | 'sort'
  | 'match'
  | 'closest_guess';

/**
 * Match only: how Scoring's scoreSubmission scores a submitted pairing.
 * `partial` (the default) splits `points` evenly across correctly paired
 * items, rounded (see scoring.ts). `all_or_nothing` instead
 * awards full points when every pair is correct, half points (rounded) when
 * exactly one pair is wrong, and zero otherwise.
 */
export type MatchScoringMode = 'partial' | 'all_or_nothing';

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
  /** Match only: undefined behaves as 'partial'. */
  matchScoringMode?: MatchScoringMode;
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

/** A not-yet-open question's position and its round's title — enough for a disabled picker slot labeled with the round it belongs to. */
export type UpcomingQuestionPosition = QuestionPosition & QuestionRoundTitle;

export interface RoundPoints {
  roundTitle: string;
  points: number;
}

export interface LeaderboardEntry {
  teamId: number;
  teamName: string;
  totalPoints: number;
  /** Competition rank (1, 2, 2, 4): the first place of this team's tie group. Decided by the server. */
  rank: number;
  /** The last place this team's tie group spans — equal to `rank` when not tied. */
  rankTo: number;
  /** Sum of this team's bonus awards, already included in totalPoints — shown separately as a badge. */
  bonusPoints: number;
  /** Sum of this team's positive bonus awards only — lets the UI show both a positive and a negative badge at once instead of collapsing to the net. */
  positiveBonusPoints: number;
  /** Sum of this team's negative bonus awards (penalties) only, as a non-positive number. */
  negativeBonusPoints: number;
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
  /** Category/topic of the round at `progress.roundIndex`, or '' when unset — shown on the round_intro screen alongside the title. */
  roundCategory: string;
  /** Author of the round at `progress.roundIndex`, or '' when unset — shown on the round_intro screen alongside the title. */
  roundAuthor: string;
  /** Whether the round at `progress.roundIndex` has kahootMode set — drives /display's top-5-only leaderboard while it's active. */
  isCurrentRoundKahoot: boolean;
  /** Title of every round in the quiz, in order — always populated (like `quizStructure`), used by the `round_overview` screen. */
  roundTitles: string[];
  /** Category of every round in the quiz, in order, '' where unset — parallel to `roundTitles`, used by the `round_overview` screen. */
  roundCategories: string[];
  /** Author of every round in the quiz, in order, '' where unset — parallel to `roundTitles`, used by the `round_overview` screen. */
  roundAuthors: string[];
  currentQuestion: QuestionView | null;
  /**
   * Questions open for (re-)answering: everything revealed so far in the
   * current block while a question is open, or the whole just-locked block
   * during break/reveal (for grading). Empty otherwise.
   */
  blockQuestions: BlockQuestionView[];
  /**
   * Positions (and round titles) of the current block's remaining
   * questions — not open yet, shown as disabled slots in the block picker
   * so the whole block's shape is visible up front, spanning every round up
   * to and including the one that ends the block (breakAfter). Empty
   * unless a question is open/locking.
   */
  upcomingQuestions: UpcomingQuestionPosition[];
  /** The just-finished block's questions with correct answers, shown during reveal. Empty otherwise. */
  revealQuestions: BlockRevealQuestionView[];
  /**
   * Every question from blocks that finished before the current one, with
   * correct answers — a block can only be left behind once its own
   * break+reveal has completed, so these are always safe to share. Lets a
   * client that (re)connects mid-game (a phone that slept through a round,
   * a page refresh) rebuild its full answer history across every round
   * played so far, not just the current block.
   */
  pastRevealedQuestions: BlockRevealQuestionView[];
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
  /** Epoch-ms deadline when the currently-open kahootMode question auto-locks, or null when not armed (non-kahoot round, unlimited setting, or a historical question revisited via Previous). */
  kahootQuestionEndsAt: number | null;
  /**
   * closest_guess only — which reveal sub-step (0-indexed) is shown for the
   * question currently at revealIndex. Ephemeral, like leaderboardRevealCount:
   * not part of GameProgress, not persisted, meaningless for every other
   * status/type. 0 whenever the current reveal question isn't closest_guess.
   */
  closestGuessRevealStep: number;
  /**
   * Epoch-ms time the admin expects the break to end, or null when unset —
   * shown as a "back at HH:MM" line on the display's break screen. Ephemeral
   * (not persisted) and admin-editable via SET_BREAK_END_TIME; reset to null
   * whenever a fresh break starts (entering 'break_intro' from 'locking').
   */
  breakEndsAt: number | null;
  /**
   * Text-size multiplier applied to every /display screen except the
   * persistent header, admin-editable via SET_DISPLAY_TEXT_SCALE — see
   * DISPLAY_TEXT_SCALE_STEPS. Ephemeral (not persisted), defaults to
   * DEFAULT_DISPLAY_TEXT_SCALE.
   */
  displayTextScale: number;
  /**
   * Epoch-ms the currently-displayed question/grading block started, or
   * null when it isn't live. There is at most one live timed phase per
   * session (the "frontier" — the most recent genuinely-new question or
   * block to open); Previous, and any detour through an untimed status,
   * never stop it, so it keeps ticking in the background and shows its full
   * elapsed time whenever it's displayed again — undiminished by wherever
   * the admin wandered via Previous in between. Mutually exclusive with
   * phaseElapsedMs: exactly one of the two is non-null whenever the current
   * status is timed at all.
   */
  phaseStartedAt: number | null;
  /**
   * Final, immutable elapsed-ms for the currently-displayed question/
   * grading block, once it's been superseded by a *different* genuinely new
   * phase — null while it's still the live frontier (see phaseStartedAt) or
   * the current status isn't timed at all. Set exactly once and never
   * recomputed, even if displayed again later via Previous.
   */
  phaseElapsedMs: number | null;
  /** This session's configurable settings — see SessionSettings. */
  settings: SessionSettings;
  /**
   * The in-progress/just-resolved showdown tiebreaker round, or null between
   * rounds. Only ever set while progress.status === 'ended' — see
   * ActiveShowdownView. Fields are progressively included based on
   * showdownRevealStep, the same secrecy technique already used for
   * ClosestGuessRevealData.
   */
  activeShowdown: ActiveShowdownView | null;
  /**
   * Showdown reveal sub-step (0-indexed), ephemeral like
   * closestGuessRevealStep: 0..(participants.length + 1). Meaningless
   * whenever activeShowdown is null.
   */
  showdownRevealStep: number;
}

/**
 * What each room receives on STATE_UPDATED / STATE_SYNC. The snapshot above
 * is the shared base of every view; each audience's view is that base with
 * what the audience must not see removed (and, in later tickets, its own
 * computed fields added). Keep them as separate names so a page can only
 * read what its own room is sent.
 */
/** What /display renders: the snapshot plus the screen on air, resolved once by the server. */
export interface DisplayStatePayload extends StateSnapshotPayload {
  /** The named screen on air, and the question or round it is about. */
  onAirScreen: OnAirScreen;
  /** Transition key — changes only when what's on screen changes. */
  screenKey: string;
  /** Header label/title/badge for the screen on air. */
  header: HeaderContent;
  /** True while the between-questions leaderboard covers a kahoot question that is already open underneath. */
  isBetweenKahootQuestions: boolean;
}
/** What the admin's Advance slot does on its next press, decided by the server: reveal the next leaderboard rank, hide the leaderboard, advance the quiz (a transition, a showdown or closest_guess step), or nothing. */
export type AdvanceSlotStep =
  | 'reveal_next_rank'
  | 'hide_leaderboard'
  | 'advance'
  | 'none';

/** Whether the admin's Previous button works: available, shown greyed out because the leaderboard covers the screen, or unavailable (hidden). */
export type PreviousState =
  | 'available'
  | 'covered_by_leaderboard'
  | 'unavailable';

/** The quiz master's view: the snapshot plus the screen on air and what /control's question browser marks as on air. */
export interface AdminStatePayload
  extends StateSnapshotPayload, AdminIndicators {
  onAirScreen: OnAirScreen;
  /** What a press of the Advance slot does next — the Move plan's step for ADVANCE. */
  advanceStep: AdvanceSlotStep;
  /** Whether PREVIOUS works, is covered by the leaderboard, or is unavailable — the Move plan's verdict for PREVIOUS. */
  previousState: PreviousState;
  /** Whether the server will accept ADVANCE right now with the leaderboard set aside — decided by the same intercepts and state machine the action handler applies. Kept for clients that still derive the leaderboard steps themselves. */
  canAdvance: boolean;
  /** Whether the server will accept PREVIOUS right now and it does something. */
  canGoToPreviousQuestion: boolean;
  /** roundIndex of the first round in the block that is open, locked or under review, per the session's own rounds — where the question browser's active block begins. */
  activeBlockStartIndex: number;
  /** Whether the quiz master may set up the showdown tiebreaker now: the final round is graded (no ungraded questions left, in a graded status). */
  isShowdownEligible: boolean;
  /** Whether a question is open or locking and it is a break point in the session's own round structure. */
  isLastQuestionBeforeBreak: boolean;
}
/** A team phone's view — a kahoot question hidden behind the between-questions leaderboard is removed from `currentQuestion` and `blockQuestions` on the server. */
export interface PlayersStatePayload
  extends StateSnapshotPayload, PlayersScreenFields {
  /** Whether the current block can be answered right now — the same rule the answer-submission gate enforces. */
  isAnswerable: boolean;
}

/** The view type each socket room is sent. */
export interface StateViewByRoom {
  display: DisplayStatePayload;
  admin: AdminStatePayload;
  players: PlayersStatePayload;
}

export interface AdminActionPayload {
  action: GameAction;
}

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
  /** Set for auto-graded types (multiple_choice/sort/match/free_text), graded the instant they're submitted; 0 for types that need admin grading (audio/youtube) until GRADE_ANSWER fires. */
  pointsAwarded: number;
  /** Set the instant auto-graded types are submitted; null until the admin grades an audio/youtube answer. */
  gradedAt: string | null;
  /** Set together with gradedAt; null until graded. */
  verdict: Verdict | null;
}

export interface JoinPlayersPayload {
  teamName: string;
  teamToken?: string;
  teamCode?: string;
  joinCode?: string;
  /** The socket id this device held the team on before an auto-reconnect — lets the server hand the team over from that stale socket (still "live" until its ping timeout notices it's dead) instead of rejecting the rejoin as a second device. */
  previousSocketId?: string;
}

export interface TeamAnswerView {
  questionId: number;
  value: string;
  pointsAwarded: number;
  /** Set once this answer is graded (instantly for auto-graded types, on admin grading for the rest) — the source of truth for "is this graded", since pointsAwarded defaults to 0 before grading. */
  gradedAt: string | null;
  /** Set together with gradedAt: how the answer was judged, independent of speed scaling or partial rounding. Null until graded. */
  verdict: Verdict | null;
}

export interface JoinAcceptedPayload {
  teamId: number;
  teamToken: string;
  teamCode: string;
  teamName: string;
  /** The team's saved answers in this session, so reconnects restore them. */
  answers: TeamAnswerView[];
  /** The team's own bonus awards so far this session, so reconnects restore them. */
  bonusAwards: TeamBonusAwardView[];
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

/**
 * Presenter-remote-only context (host notes + a preview of the next
 * question): only ever sent over PRESENTER_CONTEXT_UPDATED, emitted to the
 * admin room alone. Must NEVER be folded into StateSnapshotPayload/
 * broadcastGameState's tri-room emit — players and the display must never
 * receive next-question content or host notes.
 */
/** A short description of one /display screen, as shown on /remote. */
export interface ScreenPreview {
  heading: string;
  body?: string;
  /** Full question content (including the correct answer) when the screen is an open question. */
  question?: RevealQuestionView;
}

export interface PresenterContextPayload {
  /** Host-only notes for the currently open question, or null when none is open or none were authored. */
  currentQuestionNotes: string | null;
  /** What /display is showing right now. */
  currentScreen: ScreenPreview;
  /** What /display will show after the remote's Advance button is pressed, or null when Advance has nowhere left to go. */
  nextScreen: ScreenPreview | null;
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

export interface KickTeamPayload {
  teamId: number;
}

/**
 * A team's own explicit "log out" — the app has no dedicated rename feature,
 * so changing a team's display name means logging out and rejoining under a
 * new name. Without this, the old identity's roster row lingers in
 * TeamView/`/control` until an admin kicks it by hand; sending this first
 * removes it automatically, mirroring what KICK_TEAM does server-side minus
 * the forced disconnect (the caller is already leaving on its own).
 */
export interface LeaveSessionPayload {
  teamId: number;
}

/** Admin-set/clear the display's break-end-time line — null clears it back to unset. */
export interface SetBreakEndTimePayload {
  breakEndsAt: number | null;
}

/** Discrete steps the admin can pick between for /display's text size — 1 is the original, unscaled size. */
export const DISPLAY_TEXT_SCALE_STEPS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export const DEFAULT_DISPLAY_TEXT_SCALE: (typeof DISPLAY_TEXT_SCALE_STEPS)[number] = 1;

/** Admin-set text-size multiplier for /display (every screen except the header) — see DISPLAY_TEXT_SCALE_STEPS. */
export interface SetDisplayTextScalePayload {
  displayTextScale: number;
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
  /** Plays a ~60s countdown track during the 'locking' phase on /display and /admin, timed to end exactly at questionLockAt regardless of lockGraceSeconds. */
  playLockCountdownSound: boolean;
  /** Whether ADVANCE from 'rules' shows a 'round_overview' screen (listing every round's title) before round 0's own 'round_intro' — lets an admin who doesn't want to spoil the round lineup turn it off. */
  showRoundOverview: boolean;
  /** One entry per rendered /rules bullet line — display text only, no enforcement. */
  rules: string[];
  /** Caps how many times a single team may be awarded a given bonus category this session (e.g. shot: 2, selfie: 1); a category absent from the map has no cap. */
  maxBonusAwardsPerCategory: Partial<Record<BonusCategory, number>>;
  /** Team size cap — display text only, no enforcement. Shown in the /display QR caption and the generated first /rules bullet. */
  maxPlayersPerTeam: number;
  /** Points deducted per player beyond maxPlayersPerTeam — display text only, no enforcement. Shown in the generated first /rules bullet. */
  extraPlayerPenaltyPoints: number;
  /** Seconds a kahootMode round's question stays open before auto-locking, or null for unlimited (no timer armed). */
  kahootQuestionTimerSeconds: number | null;
}

/** Default prefill for kahootQuestionTimerSeconds when the frontend detects the quiz being started contains a kahootMode round — see session-picker-panel.tsx. */
export const DEFAULT_KAHOOT_QUESTION_TIMER_SECONDS = 30;

// Frozen (including its array and map fields) so no code path can ever
// mutate this shared singleton in place: every session created with default
// settings (GameSession's entity default, SeedService.createSession's
// default param, resolveSessionSettings) holds this exact reference until
// something explicitly overrides it, so an accidental .push()/.splice()/
// key-assignment here would silently corrupt every other session's
// rules/categories/caps for the life of the process. Spreading/mapping/
// filtering — the only operations any call site actually performs — all
// still work unchanged.
export const DEFAULT_SESSION_SETTINGS: SessionSettings = Object.freeze({
  lockGraceSeconds: 60,
  enabledBonusCategories: Object.freeze([
    ...BONUS_CATEGORIES,
  ]) as BonusCategory[],
  autoplayMedia: true,
  playLockCountdownSound: true,
  showRoundOverview: false,
  maxBonusAwardsPerCategory: Object.freeze({
    shot: 2,
    selfie: 1,
  }) as Partial<Record<BonusCategory, number>>,
  maxPlayersPerTeam: 6,
  extraPlayerPenaltyPoints: 2,
  kahootQuestionTimerSeconds: null,
  rules: Object.freeze([
    'No cheating.',
    'Please write your answers in English.',
    'In case of disagreements, the organizers have the final word.',
    'Want to contest something? Come with a credible source.',
    'In case of no correct answers, the moderator CAN award a bonus point to the team with the funniest answer.',
  ]) as string[],
});

export interface AwardBonusPayload {
  teamId: number;
  category: BonusCategory;
  /** Free-text reason, required for category "custom", ignored otherwise. */
  reason?: string;
  points: number;
}

/** One bonus award a team has actually received — the team-facing view used by both JoinAcceptedPayload.bonusAwards and BONUS_AWARDED. */
export interface TeamBonusAwardView {
  category: BonusCategory;
  points: number;
  /** Present only for category "custom". */
  reason?: string;
}

/** Admin-only view of one bonus award — adds the id/timestamp a team-facing TeamBonusAwardView doesn't need. */
export interface BonusAwardAdminView extends TeamBonusAwardView {
  id: number;
  createdAt: string;
}

/** Response for GET /sessions/:joinCode/teams/:teamId/bonus-awards. */
export interface BonusAwardsListedPayload {
  teamId: number;
  awards: BonusAwardAdminView[];
}

/** Request body for PATCH /sessions/:joinCode/bonus-awards/:awardId. Category is intentionally not editable — changing it could invalidate the reason requirement for "custom". */
export interface UpdateBonusAwardRequest {
  points: number;
  reason?: string;
}

/** Pushed privately to a team's own connected socket the moment the admin awards it a bonus — mirrors ANSWER_RECEIVED's single-item, append-don't-replace shape. */
export type BonusAwardedPayload = TeamBonusAwardView;

/** Broadcast to a session's players room once its admin closes it — the session no longer exists server-side, so the client should drop its identity and return to the join screen. */
export interface SessionClosedPayload {
  joinCode: string;
}

/**
 * Admin-typed tiebreaker question for a "showdown" round — created once
 * two or more teams are tied for 1st place at `ended`. Participating teams
 * are never client-supplied: the server derives them from the leaderboard
 * via getTiedForFirst (shared/types/src/leaderboard-tiebreak.ts).
 */
export interface CreateShowdownRoundPayload {
  question: string;
  /** Numeric string, parsed like Question.answer for closest_guess. */
  answer: string;
  points: number;
}

export interface SubmitShowdownGuessPayload {
  showdownRoundId: number;
  teamId: number;
  value: string;
}

/** One participating team's showdown status, in seatIndex (reveal) order. */
export interface ActiveShowdownParticipant {
  teamId: number;
  teamName: string;
  /** Reveal order, 0..N-1 — fixed at round creation from leaderboard order. */
  seatIndex: number;
  /** Always present — status only, no value (mirrors answeredTeamIds). */
  hasGuessed: boolean;
  /** Present once showdownRevealStep >= seatIndex + 1. */
  guess?: string;
}

/** The in-progress/just-resolved showdown tiebreaker round — see StateSnapshotPayload.activeShowdown. */
export interface ActiveShowdownView {
  id: number;
  question: string;
  participants: ActiveShowdownParticipant[];
  /** Present once showdownRevealStep >= participants.length + 1 (final step). */
  answer?: string;
  /** null when isTie is true, or before the round is resolved. */
  winnerTeamId?: number | null;
  isTie?: boolean;
}

/**
 * What the server replies with (as the Socket.IO acknowledgement) to every
 * client-to-server event. `error` is always client-safe: a domain rejection's
 * own message, or a generic one for an unexpected failure.
 */
export type AckResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };
