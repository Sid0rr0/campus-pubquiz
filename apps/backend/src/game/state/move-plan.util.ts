import {
  IllegalGameTransitionError,
  getLeaderboardRevealStepCount,
  getNextGameState,
  type AdvanceSlotStep,
  type GameAction,
  type GameProgress,
  type PreviousState,
} from '@campus-pubquiz/types';
import { tryStepClosestGuessReveal } from '@/game/state/closest-guess-reveal.util';
import { ShowdownGuessesPendingError } from '@/game/state/errors/showdown-guesses-pending.error';
import { getGameContext, type SessionState } from '@/game/state/session-state';
import { tryStepShowdownReveal } from '@/game/state/showdown-reveal.util';

export type Movement = 'ADVANCE' | 'PREVIOUS';

/** The one step a press of ADVANCE or PREVIOUS would take right now. */
export type MoveStep =
  /** ADVANCE under the leaderboard with ranks still hidden: shows the next rank, the quiz underneath stays put. */
  | {
      kind: 'leaderboard_reveal';
      progress: GameProgress;
      /** The rank this press shows, 1-based, out of `placeCount` reveal steps. */
      place: number;
      placeCount: number;
    }
  /** ADVANCE under the leaderboard with every rank shown: hides the board, exactly as the Leaderboard toggle does. */
  | { kind: 'leaderboard_hide'; progress: GameProgress }
  /** A showdown reveal step; `shouldResolve` when it crosses into the final step. */
  | {
      kind: 'showdown_step';
      session: SessionState;
      shouldResolve: boolean;
      isPressable: boolean;
    }
  /** ADVANCE on a showdown that is still waiting for guesses: pressable, but answers with what is missing. */
  | { kind: 'showdown_waiting' }
  | { kind: 'closest_guess_step'; session: SessionState }
  | { kind: 'transition'; progress: GameProgress }
  | { kind: 'blocked'; cause: unknown };

/**
 * What one ADVANCE or PREVIOUS press would do to `session`, decided once for
 * everything that needs to know — the action handler carries the step out,
 * the admin view announces it, and the presenter preview describes it.
 * Precedence: the leaderboard when it is up (it covers the screen, so a press
 * only ever reveals a rank or hides the board and never moves the quiz
 * underneath), then what is underneath it — see planUnderlyingMove.
 */
export function planMove(session: SessionState, movement: Movement): MoveStep {
  const { progress } = session;
  if (!progress.isLeaderboardVisible)
    return planUnderlyingMove(session, movement);

  if (movement === 'PREVIOUS') {
    return {
      kind: 'blocked',
      cause: new IllegalGameTransitionError(progress.status, movement),
    };
  }

  const placeCount = getLeaderboardRevealSteps(session);
  if (session.leaderboardRevealCount < placeCount) {
    return {
      kind: 'leaderboard_reveal',
      progress,
      place: session.leaderboardRevealCount + 1,
      placeCount,
    };
  }

  // Hiding is only offered when the status underneath can advance, so the
  // button never offers a move that goes nowhere.
  const underneath = planUnderlyingMove(session, movement);
  if (!isStepPressable(underneath)) return underneath;
  return {
    kind: 'leaderboard_hide',
    progress: getNextGameState(
      progress,
      'TOGGLE_LEADERBOARD',
      getGameContext(session),
    ),
  };
}

function getLeaderboardRevealSteps(session: SessionState): number {
  const isKahoot =
    session.seededGame.rounds[session.progress.roundIndex]?.kahootMode ?? false;
  return getLeaderboardRevealStepCount(session.leaderboard, isKahoot);
}

/**
 * What a press would do to the quiz itself, leaderboard aside: the showdown
 * reveal walk once the quiz has ended, then the closest_guess sub-steps, then
 * the state machine.
 *
 * The showdown only takes over at status 'ended': the admin can compose the
 * tiebreaker as soon as the final block is graded, well before the quiz
 * ends, and ADVANCE must keep driving that block's own reveal until then.
 */
function planUnderlyingMove(
  session: SessionState,
  movement: Movement,
): MoveStep {
  const { progress } = session;

  if (progress.status === 'ended' && session.activeShowdownRound !== null) {
    const showdownStep = planShowdownStep(session, movement);
    if (showdownStep) return showdownStep;
  }

  if (progress.status === 'reveal') {
    const stepped = tryStepClosestGuessReveal(session, movement);
    if (stepped) return { kind: 'closest_guess_step', session: stepped };
  }

  try {
    return {
      kind: 'transition',
      progress: getNextGameState(progress, movement, getGameContext(session)),
    };
  } catch (cause) {
    return { kind: 'blocked', cause };
  }
}

function planShowdownStep(
  session: SessionState,
  movement: Movement,
): MoveStep | null {
  try {
    const stepped = tryStepShowdownReveal(session, movement);
    if (!stepped) return null;
    return {
      kind: 'showdown_step',
      session: stepped.session,
      shouldResolve: stepped.shouldResolve,
      // ADVANCE always answers (a repeat on the last step is a harmless
      // no-op); PREVIOUS only has somewhere to go after the first step.
      isPressable: movement === 'ADVANCE' || session.showdownRevealStep > 0,
    };
  } catch (error) {
    if (error instanceof ShowdownGuessesPendingError) {
      return { kind: 'showdown_waiting' };
    }
    throw error;
  }
}

/** The state-machine action a leaderboard step is carried out as, or `pressed` for any other step. */
export function effectiveActionOf(
  step: MoveStep,
  pressed: GameAction,
): GameAction {
  return step.kind === 'leaderboard_hide' ? 'TOGGLE_LEADERBOARD' : pressed;
}

/** Whether pressing the step does something the admin should be offered. The ungraded-answers gate and a showdown waiting for guesses count as pressable — pressing them answers with what is missing. */
function isStepPressable(step: MoveStep): boolean {
  if (step.kind === 'blocked') return false;
  return step.kind !== 'showdown_step' || step.isPressable;
}

/** What the Advance slot does on its next press, as the admin view announces it. */
export function describeAdvanceStep(session: SessionState): AdvanceSlotStep {
  const step = planMove(session, 'ADVANCE');
  switch (step.kind) {
    case 'leaderboard_reveal':
      return 'reveal_next_rank';
    case 'leaderboard_hide':
      return 'hide_leaderboard';
    default:
      return isStepPressable(step) ? 'advance' : 'none';
  }
}

/** Whether Previous works, is covered by the leaderboard, or is unavailable, as the admin view announces it. */
export function describePreviousState(session: SessionState): PreviousState {
  if (!isUnderlyingMoveAvailable(session, 'PREVIOUS')) return 'unavailable';
  return session.progress.isLeaderboardVisible
    ? 'covered_by_leaderboard'
    : 'available';
}

/** Whether the admin's button for `movement` would be on with the leaderboard set aside. */
function isUnderlyingMoveAvailable(
  session: SessionState,
  movement: Movement,
): boolean {
  return isStepPressable(planUnderlyingMove(session, movement));
}
