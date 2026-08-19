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

/** How long the 'locking' countdown runs before auto-advancing into the break. */
export const QUESTION_LOCK_DURATION_MS = 60_000;

/** Everything GameStateService tracks for one concurrently-running GameSession, keyed by its joinCode. */
export interface SessionState {
  seededGame: SeededGame;
  progress: GameProgress;
  /** Epoch-ms deadline for auto-locking the current question, or null when none is armed. */
  questionLockAt: number | null;
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
}

export function freshSessionState(
  seededGame: SeededGame,
  progress: GameProgress,
): SessionState {
  return {
    seededGame,
    progress,
    questionLockAt: computeQuestionLockAt(progress),
    leaderboard: [],
    leaderboardRevealCount: 0,
    teams: [],
    answeredTeamIdsByQuestion: {},
    connectedTeamSockets: {},
    closestGuessRevealStep: 0,
    closestGuessSummaries: {},
    ungradedQuestionIds: [],
  };
}

/**
 * Recomputes the auto-lock deadline for a given progress: armed only while
 * in the 'locking' countdown, so a gateway timer can advance into the break
 * automatically without the admin clicking Advance.
 */
export function computeQuestionLockAt(progress: GameProgress): number | null {
  return progress.status === 'locking'
    ? Date.now() + QUESTION_LOCK_DURATION_MS
    : null;
}

export function getGameContext(session: SessionState): GameContext {
  return {
    rounds: session.seededGame.rounds.map((round) => ({
      questionCount: round.questions.length,
      breakAfter: round.breakAfter,
    })),
  };
}
