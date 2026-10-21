import { closestGuessRevealDescriptor } from './closest-guess-reveal';
import type { GameAction, GameProgress } from './game-state-types';
import type { SessionState } from './session-state';
import { showdownRevealDescriptor } from './showdown-reveal';

/** The reveals that walk one line per Advance. */
export type SteppedRevealKind = 'closest_guess' | 'showdown';

/** What happens on a press past an end of a reveal: stay put, or let the state machine move on. */
export type RevealEnd = 'hold' | 'fall_through';

/** What a stepped reveal supplies; the Stepped reveal module does the rest. */
export interface SteppedRevealDescriptor {
  /** How many steps the reveal has, numbered 0 to stepCount - 1. */
  stepCount: number;
  /** What Previous does on step 0. */
  atStart: RevealEnd;
  /** What Advance does on the last step. */
  atEnd: RevealEnd;
  /** The first-Advance guard: false while Advance on step 0 must wait. */
  canStart: boolean;
}

type Movement = 'ADVANCE' | 'PREVIOUS';

/** One press on a stepped reveal. */
export type SteppedMove =
  | { kind: 'step'; step: number; isFinal: boolean }
  | { kind: 'hold' }
  | { kind: 'fall_through' }
  | { kind: 'wait' };

/** Whether `step` is the reveal's last step. */
export function isFinalStep(
  descriptor: SteppedRevealDescriptor,
  step: number,
): boolean {
  return step >= descriptor.stepCount - 1;
}

/** What a movement does to a reveal standing on `step`. */
export function stepReveal(
  descriptor: SteppedRevealDescriptor,
  step: number,
  movement: Movement,
): SteppedMove {
  if (movement === 'PREVIOUS') {
    if (step > 0) return { kind: 'step', step: step - 1, isFinal: false };
    return { kind: descriptor.atStart };
  }
  if (step === 0 && !descriptor.canStart) return { kind: 'wait' };
  if (isFinalStep(descriptor, step)) return { kind: descriptor.atEnd };
  const next = step + 1;
  return {
    kind: 'step',
    step: next,
    isFinal: isFinalStep(descriptor, next),
  };
}

/** The step a reveal starts on: 0 landing forward, its last step landing on Previous. */
export function startStepOf(
  descriptor: SteppedRevealDescriptor,
  action: GameAction | null,
): number {
  return action === 'PREVIOUS' ? descriptor.stepCount - 1 : 0;
}

/** A stepped reveal that is on air, with the step it stands on. */
export interface RevealOnAir {
  reveal: SteppedRevealKind;
  descriptor: SteppedRevealDescriptor;
  step: number;
}

/** Which stepped reveal `progress` puts on air for `session`, if any. */
function descriptorOnAir(
  session: SessionState,
  progress: GameProgress,
): { reveal: SteppedRevealKind; descriptor: SteppedRevealDescriptor } | null {
  // The showdown only takes over once the quiz has ended: it can be composed
  // well before, while the block's own reveal is still on air.
  if (progress.status === 'ended' && session.activeShowdownRound !== null) {
    return {
      reveal: 'showdown',
      descriptor: showdownRevealDescriptor(session.activeShowdownRound),
    };
  }
  const closestGuess = closestGuessRevealDescriptor(session, progress);
  return closestGuess
    ? { reveal: 'closest_guess', descriptor: closestGuess }
    : null;
}

/** The stepped reveal on air, if any, with the session's counter as its step. */
export function revealOnAir(session: SessionState): RevealOnAir | null {
  const onAir = descriptorOnAir(session, session.progress);
  if (!onAir) return null;
  return { ...onAir, step: session.revealStep };
}

/** The step of reveal `reveal`: the counter while it is on air, 0 otherwise. */
export function revealStepOf(
  session: SessionState,
  reveal: SteppedRevealKind,
): number {
  const onAir = revealOnAir(session);
  return onAir?.reveal === reveal ? onAir.step : 0;
}

/** The step the reveal on air under `progress` starts on, when it lands by `action`; 0 when no stepped reveal is on air. */
export function revealStartStep(
  session: SessionState,
  progress: GameProgress,
  action: GameAction | null,
): number {
  const onAir = descriptorOnAir(session, progress);
  return onAir ? startStepOf(onAir.descriptor, action) : 0;
}

/** What a movement does to the stepped reveal on air; `none` when there is none. */
export type OnAirMove =
  | { kind: 'none' }
  | {
      kind: 'step';
      reveal: SteppedRevealKind;
      session: SessionState;
      isFinal: boolean;
    }
  | { kind: 'hold' | 'fall_through' | 'wait'; reveal: SteppedRevealKind };

/** Steps the reveal on air by a movement, returning the session with its new step. */
export function stepRevealOnAir(
  session: SessionState,
  movement: Movement,
): OnAirMove {
  const onAir = revealOnAir(session);
  if (!onAir) return { kind: 'none' };
  const move = stepReveal(onAir.descriptor, onAir.step, movement);
  if (move.kind !== 'step') return { kind: move.kind, reveal: onAir.reveal };
  return {
    kind: 'step',
    reveal: onAir.reveal,
    session: { ...session, revealStep: move.step },
    isFinal: move.isFinal,
  };
}
