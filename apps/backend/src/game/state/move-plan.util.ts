import { getNextGameState, type GameProgress } from '@campus-pubquiz/types';
import { tryStepClosestGuessReveal } from '@/game/state/closest-guess-reveal.util';
import { ShowdownGuessesPendingError } from '@/game/state/errors/showdown-guesses-pending.error';
import { getGameContext, type SessionState } from '@/game/state/session-state';
import { tryStepShowdownReveal } from '@/game/state/showdown-reveal.util';

export type Movement = 'ADVANCE' | 'PREVIOUS';

/** The one step a press of ADVANCE or PREVIOUS would take right now. */
export type MoveStep =
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
 * the admin view derives its button availability from it, and the presenter
 * preview describes it. Precedence: the showdown reveal walk once the quiz
 * has ended, then the closest_guess sub-steps, then the state machine.
 *
 * The showdown only takes over at status 'ended': the admin can compose the
 * tiebreaker as soon as the final block is graded, well before the quiz
 * ends, and ADVANCE must keep driving that block's own reveal until then.
 */
export function planMove(session: SessionState, movement: Movement): MoveStep {
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

/** Whether the admin's button for `movement` is on: the plan is not blocked. The ungraded-answers gate and a showdown waiting for guesses count as available — pressing them answers with what is missing. */
export function isMoveAvailable(
  session: SessionState,
  movement: Movement,
): boolean {
  const step = planMove(session, movement);
  if (step.kind === 'blocked') return false;
  return step.kind !== 'showdown_step' || step.isPressable;
}
