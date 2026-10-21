import { describe, expect, it } from 'vitest';
import { DEFAULT_SESSION_SETTINGS } from '../session-settings';
import { freshSessionState } from '../session-state';
import {
  isFinalStep,
  revealOnAir,
  revealStepOf,
  startStepOf,
  stepReveal,
  stepRevealOnAir,
  type SteppedRevealDescriptor,
} from '../stepped-reveal';

/** Three steps (0, 1, 2) that fall through at both ends and have no guard. */
const falling: SteppedRevealDescriptor = {
  stepCount: 3,
  atStart: 'fall_through',
  atEnd: 'fall_through',
  canStart: true,
};

const holding: SteppedRevealDescriptor = {
  ...falling,
  atStart: 'hold',
  atEnd: 'hold',
};

describe('stepReveal', () => {
  it('advances to the next step inside the bounds', () => {
    expect(stepReveal(falling, 0, 'ADVANCE')).toEqual({
      kind: 'step',
      step: 1,
      isFinal: false,
    });
  });

  it('flags the press that reaches the final step', () => {
    expect(stepReveal(falling, 1, 'ADVANCE')).toEqual({
      kind: 'step',
      step: 2,
      isFinal: true,
    });
  });

  it('goes back one step on Previous without flagging the final step', () => {
    expect(stepReveal(falling, 2, 'PREVIOUS')).toEqual({
      kind: 'step',
      step: 1,
      isFinal: false,
    });
  });

  it('falls through to the state machine past the last step when the reveal falls through', () => {
    expect(stepReveal(falling, 2, 'ADVANCE')).toEqual({ kind: 'fall_through' });
  });

  it('falls through before the first step when the reveal falls through', () => {
    expect(stepReveal(falling, 0, 'PREVIOUS')).toEqual({
      kind: 'fall_through',
    });
  });

  it('holds past the last step when the reveal holds', () => {
    expect(stepReveal(holding, 2, 'ADVANCE')).toEqual({ kind: 'hold' });
  });

  it('holds before the first step when the reveal holds', () => {
    expect(stepReveal(holding, 0, 'PREVIOUS')).toEqual({ kind: 'hold' });
  });

  it('holds at one end and falls through at the other when the descriptor says so', () => {
    const mixed = {
      ...falling,
      atStart: 'hold',
      atEnd: 'fall_through',
    } as const;
    expect(stepReveal(mixed, 0, 'PREVIOUS')).toEqual({ kind: 'hold' });
    expect(stepReveal(mixed, 2, 'ADVANCE')).toEqual({ kind: 'fall_through' });
  });

  it('waits on the first Advance while the guard refuses', () => {
    const guarded = { ...holding, canStart: false };
    expect(stepReveal(guarded, 0, 'ADVANCE')).toEqual({ kind: 'wait' });
  });

  it('lets the guard off once the reveal is past its first step', () => {
    const guarded = { ...holding, canStart: false };
    expect(stepReveal(guarded, 1, 'ADVANCE')).toEqual({
      kind: 'step',
      step: 2,
      isFinal: true,
    });
  });

  it('never waits on Previous', () => {
    const guarded = { ...holding, canStart: false };
    expect(stepReveal(guarded, 0, 'PREVIOUS')).toEqual({ kind: 'hold' });
  });

  it('treats a one-step reveal as final from the start, falling through on Advance', () => {
    const single = { ...falling, stepCount: 1 };
    expect(stepReveal(single, 0, 'ADVANCE')).toEqual({ kind: 'fall_through' });
    expect(isFinalStep(single, 0)).toBe(true);
  });
});

describe('startStepOf', () => {
  it('starts at step 0 when the reveal lands forward', () => {
    expect(startStepOf(falling, 'ADVANCE')).toBe(0);
    expect(startStepOf(falling, null)).toBe(0);
  });

  it('starts at the last step when the reveal lands on Previous', () => {
    expect(startStepOf(falling, 'PREVIOUS')).toBe(2);
  });
});

describe('reading a reveal step', () => {
  it('is 0 for a reveal that is not on air, whatever the counter holds', () => {
    const session = {
      ...freshSessionState({
        quizId: 1,
        gameSessionId: 1,
        joinCode: 'ABCDEF',
        rounds: [],
        settings: DEFAULT_SESSION_SETTINGS,
      }),
      closestGuessRevealStep: 3,
    };
    expect(revealOnAir(session)).toBeNull();
    expect(revealStepOf(session, 'closest_guess')).toBe(0);
    expect(stepRevealOnAir(session, 'ADVANCE')).toEqual({ kind: 'none' });
  });
});

describe('isFinalStep', () => {
  it('is true only on the last step', () => {
    expect(isFinalStep(falling, 1)).toBe(false);
    expect(isFinalStep(falling, 2)).toBe(true);
  });
});
