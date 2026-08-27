import type {
  ClosestGuessRevealData,
  GameContext,
  GameProgress,
  LeaderboardEntry,
} from '@campus-pubquiz/types';
import type { SeededGame } from '@/db/seed.types';
import type { TeamRosterEntry } from '@/team/team.service';

export const LOBBY_PROGRESS: GameProgress = {
  status: 'lobby',
  roundIndex: 0,
  questionIndex: 0,
  isLeaderboardVisible: false,
  revealIndex: 0,
  furthestOpenIndex: -1,
};

/** Everything GameStateService tracks for one concurrently-running GameSession, keyed by its joinCode. */
export interface SessionState {
  seededGame: SeededGame;
  progress: GameProgress;
  /** Epoch-ms deadline for auto-locking the current question, or null when none is armed. */
  questionLockAt: number | null;
  /** Epoch-ms time the admin expects the break to end, or null when unset — see StateSnapshotPayload.breakEndsAt. */
  breakEndsAt: number | null;
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
   * (see GameStateService.refreshUngradedQuestionIds), and patched
   * per-question by the gateway after each SUBMIT_ANSWER/GRADE_ANSWER so it
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
export interface ShowdownParticipantState {
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

export function freshSessionState(
  seededGame: SeededGame,
  progress: GameProgress,
): SessionState {
  return {
    seededGame,
    progress,
    questionLockAt: computeQuestionLockAt(
      progress,
      seededGame.settings.lockGraceSeconds * 1000,
    ),
    breakEndsAt: null,
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

/**
 * Recomputes the auto-lock deadline for a given progress: armed only while
 * in the 'locking' countdown, so a gateway timer can advance into the break
 * automatically without the admin clicking Advance.
 */
export function computeQuestionLockAt(
  progress: GameProgress,
  lockDurationMs: number,
): number | null {
  return progress.status === 'locking' ? Date.now() + lockDurationMs : null;
}

export function getGameContext(session: SessionState): GameContext {
  return {
    rounds: session.seededGame.rounds.map((round) => ({
      questionCount: round.questions.length,
      breakAfter: round.breakAfter,
    })),
  };
}
