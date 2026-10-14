import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameStatus, OnAirScreen } from '@campus-pubquiz/types';
import { displaySounds } from '@/app/lib/display-sounds';
import { useRoundTitleSting } from '@/app/lib/use-round-title-sting';

interface Frame {
  status: GameStatus;
  roundIndex: number;
  screenKind: OnAirScreen['kind'];
}

const overview: Frame = {
  status: 'round_overview',
  roundIndex: 0,
  screenKind: 'round_overview',
};
const roundIntro: Frame = {
  status: 'round_intro',
  roundIndex: 0,
  screenKind: 'round_title',
};
const firstQuestion: Frame = {
  status: 'question_open',
  roundIndex: 0,
  screenKind: 'question',
};
const breakRoundIntro: Frame = {
  status: 'break_round_intro',
  roundIndex: 0,
  screenKind: 'break_round_title',
};
const revealIntro: Frame = {
  status: 'reveal_intro',
  roundIndex: 0,
  screenKind: 'reveal_intro',
};

function renderSting(initial: Frame, isConnected = true) {
  return renderHook(
    ({ frame, connected }: { frame: Frame; connected: boolean }) =>
      useRoundTitleSting(frame, connected),
    { initialProps: { frame: initial, connected: isConnected } },
  );
}

let playSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  playSpy = vi.spyOn(displaySounds, 'play').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useRoundTitleSting', () => {
  it('plays the sting when the quiz advances into the round intro', () => {
    const { rerender } = renderSting(overview);

    rerender({ frame: roundIntro, connected: true });

    expect(playSpy).toHaveBeenCalledWith('sting');
  });

  it('stays silent when the screen loads already on the round intro', () => {
    renderSting(roundIntro);

    expect(playSpy).not.toHaveBeenCalled();
  });

  it('stays silent when Previous lands back on the round intro', () => {
    const { rerender } = renderSting(firstQuestion);

    rerender({ frame: roundIntro, connected: true });

    expect(playSpy).not.toHaveBeenCalled();
  });

  it('stays silent on the break round intro', () => {
    const { rerender } = renderSting(firstQuestion);

    rerender({ frame: breakRoundIntro, connected: true });

    expect(playSpy).not.toHaveBeenCalled();
  });

  it('stays silent on the reveal intro', () => {
    const { rerender } = renderSting(breakRoundIntro);

    rerender({ frame: revealIntro, connected: true });

    expect(playSpy).not.toHaveBeenCalled();
  });

  it('plays for the next round after the previous round ended', () => {
    const { rerender } = renderSting(revealIntro);

    rerender({
      frame: { ...roundIntro, roundIndex: 1 },
      connected: true,
    });

    expect(playSpy).toHaveBeenCalledWith('sting');
  });

  it('stays silent on the first snapshot after a reconnect', () => {
    const { rerender } = renderSting(overview);
    rerender({ frame: overview, connected: false });

    rerender({ frame: roundIntro, connected: true });

    expect(playSpy).not.toHaveBeenCalled();
  });
});
