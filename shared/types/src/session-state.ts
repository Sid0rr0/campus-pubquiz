import type { GameContext, GameProgress } from './game-state-types';
import type {
  ClosestGuessRevealData,
  RevealQuestionView,
} from './question-views';
import type { LeaderboardEntry } from './room-views';
import {
  DEFAULT_DISPLAY_TEXT_SCALE,
  type SessionSettings,
} from './session-settings';

export interface SeededRound {
  id: number;
  title: string;
  breakAfter: boolean;
  /**
   * See RoundConfig.kahootMode. Optional, like questionNotesById below, so
   * callers building a SeededRound needn't set it; undefined behaves as false.
   */
  kahootMode?: boolean;
  /** Round topic/theme — see Round.category. Optional, like kahootMode above. */
  category?: string;
  /** Who wrote this round's questions — see Round.author. Optional, like kahootMode above. */
  author?: string;
  // Carries the correct answer internally so reveal can show it; only
  // answer-free QuestionView projections leave the server.
  questions: RevealQuestionView[];
  // Host-only notes, keyed by question id — deliberately a sibling of
  // `questions` rather than a field on each question object. Every
  // RevealQuestionView flows through toRevealQuestionViews' blind `{...question}`
  // spread into the broadcast snapshot; notes must never ride along. Optional
  // (like GameProgress.isMediaFullscreen) so callers building a SeededRound
  // needn't set it; undefined behaves as "no notes for any question in this
  // round".
  questionNotesById?: Record<number, string | null>;
}

export interface SeededGame {
  quizId: number;
  gameSessionId: number;
  joinCode: string;
  rounds: SeededRound[];
  settings: SessionSettings;
}

/** DB-only roster shape — live connection state is layered on by the backend. */
export interface TeamRosterEntry {
  teamId: number;
  teamName: string;
}

export const LOBBY_PROGRESS: GameProgress = {
  status: 'lobby',
  roundIndex: 0,
  questionIndex: 0,
  isLeaderboardVisible: false,
  revealIndex: 0,
  furthestOpenIndex: -1,
};

/** Everything the backend tracks for one concurrently-running GameSession, keyed by its joinCode. */
export interface SessionState {
  seededGame: SeededGame;
  progress: GameProgress;
  /** Epoch-ms deadline for auto-locking the current question, or null when none is armed. */
  questionLockAt: number | null;
  /** Epoch-ms deadline for auto-locking the currently-open kahootMode question, or null when none is armed — see computeKahootQuestionEndsAt. */
  kahootQuestionEndsAt: number | null;
  /** Epoch-ms time the admin expects the break to end, or null when unset — see StateSnapshotPayload.breakEndsAt. */
  breakEndsAt: number | null;
  /** Text-size multiplier for every /display screen except the header — see StateSnapshotPayload.displayTextScale. */
  displayTextScale: number;
  /**
   * The timed-phase key currently "live" — the most recent genuinely-new
   * question or grading block to open — or null before any timed phase has
   * ever opened. Only a genuinely new phase opening moves this; Previous,
   * and any detour through an untimed status, never touch it. See
   * computePhaseTimerFields.
   */
  livePhaseKey: string | null;
  /** Epoch-ms livePhaseKey's live segment started, or null when livePhaseKey is null. */
  phaseStartedAt: number | null;
  /**
   * Final, immutable elapsed-ms for every timed phase key that's been
   * superseded — written exactly once, the moment a *different* genuinely
   * new phase opens. Never touched again after that, even if the key is
   * later re-displayed via Previous. Ephemeral like questionLockAt/
   * breakEndsAt — resets on restart. See computePhaseTimerFields.
   */
  phaseElapsedByKey: Record<string, number>;
  /**
   * Ids of every question that has opened in this session, for good: Previous
   * stepping back never removes one. Added to in settleSession, the step every
   * press, create and restore passes through; persisted with the progress.
   * Live editing protects these questions — see live-edit-guard.
   */
  openedQuestionIds: number[];
  leaderboard: LeaderboardEntry[];
  /**
   * How many teams (counting up from last place) are currently revealed on
   * the leaderboard. Ephemeral — not persisted, resets on toggle/new game.
   */
  leaderboardRevealCount: number;
  teams: TeamRosterEntry[];
  answeredTeamIdsByQuestion: Record<number, number[]>;
  /** teamId -> socket.id of the one device currently connected as that team. */
  connectedTeamSockets: Record<number, string>;
  /** closest_guess reveal-step counter for the question at progress.revealIndex — ephemeral, not persisted. */
  closestGuessRevealStep: number;
  /** Cached per-question closest_guess grading/summary, keyed by questionId — computed once when a block locks, ephemeral like leaderboardRevealCount. */
  closestGuessSummaries: Record<number, ClosestGuessRevealData>;
  /**
   * Current-block question IDs known to have at least one ungraded answer —
   * bulk-recomputed from the DB whenever applyAction enters a grading-status
   * (see GameStateService.refreshUngradedQuestionIds), and refreshed
   * per-question through the grading refresh after each recorded/graded answer so it
   * stays live while the admin works through one break screen. Ephemeral
   * like answeredTeamIdsByQuestion — resets on restart, self-heals from the
   * next bulk recompute.
   */
  ungradedQuestionIds: number[];
  /** The in-progress/just-resolved showdown tiebreaker round, or null between rounds — see ActiveShowdownRoundState. */
  activeShowdownRound: ActiveShowdownRoundState | null;
  /** showdown reveal-step counter, ephemeral like closestGuessRevealStep — meaningless while activeShowdownRound is null. */
  showdownRevealStep: number;
}

/** One participating team's seat + guess within the active showdown round — the server-side cache backing ActiveShowdownView; the answer/guess fields are always held here in plaintext and only selectively projected out per showdownRevealStep by buildActiveShowdownView. */
interface ShowdownParticipantState {
  teamId: number;
  teamName: string;
  seatIndex: number;
  guess: string | null;
}

/** Ephemeral cache of the in-progress/just-resolved showdown round — populated from the DB once at creation/resolution (mirrors closestGuessSummaries) so buildSnapshot can stay synchronous. */
export interface ActiveShowdownRoundState {
  id: number;
  question: string;
  answer: string;
  participants: ShowdownParticipantState[];
  winnerTeamId: number | null;
  isTie: boolean;
  resolved: boolean;
}

/**
 * A session with only its progress-independent defaults. Every
 * progress-dependent field starts neutral — run it through settleSession to
 * move it to a real progress.
 */
export function freshSessionState(
  seededGame: SeededGame,
  progress: GameProgress = LOBBY_PROGRESS,
): SessionState {
  return {
    seededGame,
    progress,
    questionLockAt: null,
    kahootQuestionEndsAt: null,
    breakEndsAt: null,
    displayTextScale: DEFAULT_DISPLAY_TEXT_SCALE,
    livePhaseKey: null,
    phaseStartedAt: null,
    phaseElapsedByKey: {},
    openedQuestionIds: [],
    leaderboard: [],
    leaderboardRevealCount: 0,
    teams: [],
    answeredTeamIdsByQuestion: {},
    connectedTeamSockets: {},
    closestGuessRevealStep: 0,
    closestGuessSummaries: {},
    ungradedQuestionIds: [],
    activeShowdownRound: null,
    showdownRevealStep: 0,
  };
}

export function getGameContext(session: SessionState): GameContext {
  return {
    rounds: session.seededGame.rounds.map((round) => ({
      questionCount: round.questions.length,
      breakAfter: round.breakAfter,
      kahootMode: round.kahootMode ?? false,
    })),
    showRoundOverview: session.seededGame.settings.showRoundOverview,
  };
}
