import type { FunFactData } from './fun-facts';
import type { GameContext, GameProgress } from './game-state-types';
import type { TeamJoker } from './joker';
import type { LeagueTop } from './league';
import type { ClosestGuessRevealData, SeededQuestion } from './question-views';
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
  /**
   * Host-only round note — see Round.note. Like questionNotesById, it must
   * never go into a broadcast view on its own.
   */
  note?: string;
  /** Whether the note also shows on the big screen — see Round.showNoteOnScreen. */
  showNoteOnScreen?: boolean;
  // Carries the correct answer internally so reveal can show it; only
  // answer-free QuestionView projections leave the server.
  questions: SeededQuestion[];
  // Host-only notes, keyed by question id — deliberately a sibling of
  // `questions` rather than a field on each question object. Every
  // SeededQuestion is spread whole into the reveal views built by
  // toRevealQuestionViews, which go into the broadcast snapshot; notes must
  // never ride along. Optional
  // (like GameProgress.isMediaFullscreen) so callers building a SeededRound
  // needn't set it; undefined behaves as "no notes for any question in this
  // round".
  questionNotesById?: Record<number, string | null>;
}

export interface SeededGame {
  quizId: number;
  gameSessionId: number;
  joinCode: string;
  /** The quiz's title, refreshed whenever the game is reloaded. */
  quizTitle: string;
  /** The session's own name; null when none was set (the display name then falls back to the quiz title). */
  customName: string | null;
  /** When the session started: its row's creation time. */
  startedAt: Date;
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
  isJoinOverlayVisible: false,
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
  /** Epoch-ms deadline at which the joker pick closes and the quiz moves on by itself, or null while no pick is open — see computeJokerPickEndsAt. Like questionLockAt it is re-armed fresh (a full minute) when a restart restores a session on the pick. */
  jokerPickEndsAt: number | null;
  /** teamId -> the team's joker, for teams that have one. A cache of the stored jokers, read when the session is placed and as teams join, and updated as teams pick and as the pick closes, so the views stay synchronous. */
  jokers: Record<number, TeamJoker>;
  /** Epoch-ms time the admin expects the break to end, or null when unset — see StateSnapshotPayload.breakEndsAt. */
  breakEndsAt: number | null;
  /** Text-size multiplier for every /display screen except the header — see StateSnapshotPayload.displayTextScale. */
  displayTextScale: number;
  /** Whether the big screen's sounds are muted — see StateSnapshotPayload.isDisplaySoundMuted. */
  isDisplaySoundMuted: boolean;
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
  /**
   * The standings as they stood before the block in play, taken by
   * withPriorStandings. Null before any such write (fresh or restored session,
   * so after a restart). Ephemeral like leaderboardRevealCount.
   */
  priorStandings: PriorStandings | null;
  /**
   * The session's stored answers and bonus awards, the input to the fun facts
   * the big screen shows during a break and to the reveal's teams-correct
   * count. Read with the standings at the end of
   * every session write and on placement, so it always matches what is stored.
   * Never sent as it is: the display view carries only the facts built from it.
   * Ephemeral.
   */
  funFactData: FunFactData;
  /**
   * The league the big screen lobby shows (name and top rows), or null when the
   * session is in none. A cache: read when the session is placed and again
   * whenever its leagues change, never recomputed per broadcast. Ephemeral.
   */
  leagueTop: LeagueTop | null;
  teams: TeamRosterEntry[];
  /** teamId -> the team's player count this session, for teams that have one. A cache of the stored counts, filled as teams join and as counts are set, so the admin view stays synchronous. */
  playerCounts: Record<number, number>;
  answeredTeamIdsByQuestion: Record<number, number[]>;
  /** teamId -> socket.id of the one device currently connected as that team. */
  connectedTeamSockets: Record<number, string>;
  /** The step counter of the stepped reveal on air (the closest-guess reveal or the showdown) — ephemeral, not persisted. Read it through the Stepped reveal module, never raw: it means nothing while no stepped reveal is on air. */
  revealStep: number;
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
}

/**
 * The Prior standings: the leaderboard the session had when the block in
 * play's first question was first put in front of the teams (on air, board
 * hidden), kept for the rest of the block.
 */
export interface PriorStandings {
  board: LeaderboardEntry[];
  /** The block they were taken for, identified by its first question's id. */
  blockFirstQuestionId: number;
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
    jokerPickEndsAt: null,
    jokers: {},
    breakEndsAt: null,
    displayTextScale: DEFAULT_DISPLAY_TEXT_SCALE,
    isDisplaySoundMuted: false,
    livePhaseKey: null,
    phaseStartedAt: null,
    phaseElapsedByKey: {},
    openedQuestionIds: [],
    leaderboard: [],
    leaderboardRevealCount: 0,
    priorStandings: null,
    funFactData: { answers: [], bonusAwards: [] },
    leagueTop: null,
    teams: [],
    playerCounts: {},
    answeredTeamIdsByQuestion: {},
    connectedTeamSockets: {},
    revealStep: 0,
    closestGuessSummaries: {},
    ungradedQuestionIds: [],
    activeShowdownRound: null,
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
    jokersEnabled: session.seededGame.settings.jokersEnabled,
  };
}
