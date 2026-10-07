import type {
  AdminIndicators,
  FeedbackField,
  HeaderContent,
  OnAirScreen,
  PlayersScreenFields,
} from './on-air-screen';
import type { GameProgress, QuizStructureSummary } from './game-state';
import type {
  BlockQuestionView,
  BlockRevealQuestionView,
  PendingClosestGuessRevealView,
  QuestionView,
  RevealQuestionView,
  UpcomingQuestionPosition,
} from './question-views';
import type { QuestionType } from './question-types';
import type { SessionSettings } from './session-settings';
import type { ActiveShowdownView } from './showdown';

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
  /** The just-finished block's questions with correct answers, shown during reveal. Empty otherwise. The players view carries only the reveal walk so far (see the Screen projection). */
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
   * the leaderboard, driven by ADVANCE while the board is
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
  /** roundIndex of the first round in the block that is open, locked or under review, per the session's own rounds — where the question browser's active block begins. */
  activeBlockStartIndex: number;
  /** Whether the quiz master may set up the showdown tiebreaker now: the final round is graded (no ungraded questions left, in a graded status). */
  isShowdownEligible: boolean;
  /** Whether a question is open or locking and it is a break point in the session's own round structure. */
  isLastQuestionBeforeBreak: boolean;
}
/** A team phone's view — a kahoot question hidden behind the between-questions leaderboard is removed from `currentQuestion` and `blockQuestions` on the server. */
export interface PlayersStatePayload
  extends Omit<StateSnapshotPayload, 'revealQuestions'>, PlayersScreenFields {
  /** Which rounds the phone offers for rating right now — null when none; the same rule the server accepts a rating by. */
  feedback: FeedbackField;
  /** The reveal walk so far: questions the big screen has shown, plus the closest_guess question mid-walk without its not-yet-shown fields. */
  revealQuestions: (BlockRevealQuestionView | PendingClosestGuessRevealView)[];
  /** Whether the current block can be answered right now — the same rule the answer-submission gate enforces. */
  isAnswerable: boolean;
}

/** The view type each socket room is sent. */
export interface StateViewByRoom {
  display: DisplayStatePayload;
  admin: AdminStatePayload;
  players: PlayersStatePayload;
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
