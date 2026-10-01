import {
  getTimedPhaseKey,
  type GameAction,
  type GameContext,
  type GameProgress,
} from '@campus-pubquiz/types';
import { computeInitialRevealStep } from '@/game/state/closest-guess-reveal.util';
import { computeLeaderboardRevealCount } from '@/game/state/leaderboard-reveal.util';
import { computePhaseTimerFields } from '@/game/state/phase-timer.util';
import { getGameContext, type SessionState } from '@/game/state/session-state';

/** The persisted half of the phase timer — what a restart restores exactly. */
export interface SavedPhaseTimer {
  livePhaseKey: string | null;
  phaseStartedAt: number | null;
  phaseElapsedByKey: Record<string, number>;
}

export interface SettleInput {
  /** The session as it stands (already graded, when grading applies). */
  session: SessionState;
  /** The progress the session is moving to. */
  progress: GameProgress;
  /** The action that caused the move, or null for creating and restoring. */
  action: GameAction | null;
  /** Epoch-ms the move happens at. */
  now: number;
  /** Restore only: the saved phase timer to resume instead of deriving one. */
  savedPhaseTimer?: SavedPhaseTimer;
}

/**
 * Returns the session with every progress-dependent field consistent with
 * `progress`: the phase timer, the auto-lock and kahoot deadlines, the break
 * end time, the leaderboard reveal count and the closest_guess step. The
 * order is fixed — the phase timer first, since the kahoot deadline reads it.
 */
export function settleSession({
  session,
  progress,
  action,
  now,
  savedPhaseTimer,
}: SettleInput): SessionState {
  const context = getGameContext(session);
  const { settings } = session.seededGame;

  const { livePhaseKey, phaseStartedAt, phaseElapsedByKey } =
    savedPhaseTimer ??
    computePhaseTimerFields(
      progress,
      context,
      session.livePhaseKey,
      session.phaseStartedAt,
      session.phaseElapsedByKey,
      now,
    );

  return {
    ...session,
    progress,
    livePhaseKey,
    phaseStartedAt,
    phaseElapsedByKey,
    questionLockAt: computeQuestionLockAt(
      progress,
      settings.lockGraceSeconds * 1000,
      now,
    ),
    kahootQuestionEndsAt: computeKahootQuestionEndsAt(
      progress,
      context,
      settings.kahootQuestionTimerSeconds,
      livePhaseKey,
      phaseStartedAt,
    ),
    breakEndsAt: computeBreakEndsAt(session, progress, now),
    leaderboardRevealCount: computeLeaderboardRevealCount(
      action,
      session.progress.isLeaderboardVisible,
      progress,
      session.leaderboard,
      session.leaderboardRevealCount,
      context.rounds[progress.roundIndex]?.kahootMode ?? false,
    ),
    closestGuessRevealStep: computeInitialRevealStep(session, progress, action),
  };
}

/** Armed only while in the 'locking' countdown, so a gateway timer can advance into the break without the admin clicking Advance. */
export function computeQuestionLockAt(
  progress: GameProgress,
  lockDurationMs: number,
  now: number = Date.now(),
): number | null {
  return progress.status === 'locking' ? now + lockDurationMs : null;
}

/**
 * Armed only while `question_open` IS the live frontier phase (not a
 * Previous-revisited historical question) in a kahootMode round with a
 * per-session timer configured. Anchored to phaseStartedAt, the moment this
 * question genuinely opened, so it stays accurate across a backend restart.
 */
export function computeKahootQuestionEndsAt(
  progress: GameProgress,
  context: GameContext,
  kahootQuestionTimerSeconds: number | null,
  livePhaseKey: string | null,
  phaseStartedAt: number | null,
): number | null {
  if (progress.status !== 'question_open') return null;
  if (kahootQuestionTimerSeconds === null) return null;
  if (!context.rounds[progress.roundIndex]?.kahootMode) return null;
  if (phaseStartedAt === null) return null;
  if (getTimedPhaseKey(progress, context) !== livePhaseKey) return null;
  return phaseStartedAt + kahootQuestionTimerSeconds * 1000;
}

/**
 * A fresh break starting (the only path into 'break_intro') clears a *stale*
 * end-time left over from a previous break, so the display never shows a
 * past time. It does NOT clear one the admin set in advance while still on
 * the block's last question — that value is still in the future, so it's
 * kept. Navigating within the same break always leaves it untouched.
 */
function computeBreakEndsAt(
  session: SessionState,
  progress: GameProgress,
  now: number,
): number | null {
  const isStale =
    session.progress.status === 'locking' &&
    progress.status === 'break_intro' &&
    session.breakEndsAt !== null &&
    session.breakEndsAt <= now;
  return isStale ? null : session.breakEndsAt;
}
