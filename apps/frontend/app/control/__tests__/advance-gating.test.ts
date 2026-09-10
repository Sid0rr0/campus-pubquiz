import { describe, expect, it } from 'vitest';
import { getAdvanceGating } from '@/app/control/advance-gating';

const BASE = {
  hasActiveShowdown: false,
  showdownRevealStep: 0,
  revealIndex: 0,
  activeBlockStartIndex: 0,
  previousStatus: null,
};

describe('getAdvanceGating', () => {
  it.each([
    ['lobby', false, false],
    ['rules', true, false],
    ['round_overview', true, true],
    ['round_intro', true, true],
    ['question_open', true, true],
    ['locking', true, true],
    ['break_intro', true, true],
    ['break', true, true],
    ['reveal_intro', true, true],
    ['reveal', true, true],
  ] as const)(
    'status=%s -> canAdvance=%s, canGoToPreviousQuestion=%s',
    (gameStatus, canAdvance, canGoToPreviousQuestion) => {
      expect(getAdvanceGating({ ...BASE, gameStatus })).toEqual({
        canAdvance,
        canGoToPreviousQuestion,
      });
    },
  );

  it('break_round_intro only allows Previous once there is somewhere to go (revealIndex or a prior block)', () => {
    expect(
      getAdvanceGating({
        ...BASE,
        gameStatus: 'break_round_intro',
        revealIndex: 0,
        activeBlockStartIndex: 0,
      }).canGoToPreviousQuestion,
    ).toBe(false);

    expect(
      getAdvanceGating({
        ...BASE,
        gameStatus: 'break_round_intro',
        revealIndex: 1,
      }).canGoToPreviousQuestion,
    ).toBe(true);

    expect(
      getAdvanceGating({
        ...BASE,
        gameStatus: 'break_round_intro',
        activeBlockStartIndex: 1,
      }).canGoToPreviousQuestion,
    ).toBe(true);
  });

  it('ended: neither action is available with no active showdown and no previousStatus', () => {
    expect(getAdvanceGating({ ...BASE, gameStatus: 'ended' })).toEqual({
      canAdvance: false,
      canGoToPreviousQuestion: false,
    });
  });

  it('ended: Previous is available once a previousStatus is recorded', () => {
    expect(
      getAdvanceGating({
        ...BASE,
        gameStatus: 'ended',
        previousStatus: 'reveal',
      }).canGoToPreviousQuestion,
    ).toBe(true);
  });

  it('ended: both actions are available once a showdown is active', () => {
    expect(
      getAdvanceGating({
        ...BASE,
        gameStatus: 'ended',
        hasActiveShowdown: true,
      }),
    ).toEqual({ canAdvance: true, canGoToPreviousQuestion: false });
  });

  it('ended: Previous also becomes available mid-showdown-reveal (step > 0)', () => {
    expect(
      getAdvanceGating({
        ...BASE,
        gameStatus: 'ended',
        hasActiveShowdown: true,
        showdownRevealStep: 1,
      }).canGoToPreviousQuestion,
    ).toBe(true);
  });
});
