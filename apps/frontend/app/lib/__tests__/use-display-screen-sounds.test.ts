import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DisplayScreen } from '@campus-pubquiz/types';
import { fireConfetti } from '@/app/lib/confetti';
import { displaySounds } from '@/app/lib/display-sounds';
import {
  useDisplayScreenSounds,
  type DisplayScreenFrame,
} from '@/app/lib/use-display-screen-sounds';

vi.mock('@/app/lib/confetti', () => ({ fireConfetti: vi.fn() }));

// Only `kind` matters to the sound table; the rest of a screen is irrelevant.
function frame(
  kind: DisplayScreen['kind'],
  screenPosition: number,
): DisplayScreenFrame {
  return { screen: { kind } as DisplayScreen, screenPosition };
}

interface Props {
  frame: DisplayScreenFrame | null;
  isConnected?: boolean;
  celebrated?: boolean;
  isCountdownSoundOn?: boolean;
}

/** Renders the hook on `from`, then moves it forward to `to`. */
function moveForward(
  from: DisplayScreenFrame,
  to: DisplayScreenFrame,
  options: Omit<Props, 'frame'> = {},
) {
  const celebrated = { current: options.celebrated ?? false };
  const { rerender } = renderHook(
    ({
      frame: current,
      isConnected = true,
      isCountdownSoundOn = true,
    }: Props) =>
      useDisplayScreenSounds(
        current,
        isConnected,
        celebrated,
        isCountdownSoundOn,
      ),
    {
      initialProps: {
        frame: from,
        isConnected: options.isConnected,
        isCountdownSoundOn: options.isCountdownSoundOn,
      } as Props,
    },
  );
  rerender({
    frame: to,
    isConnected: options.isConnected,
    isCountdownSoundOn: options.isCountdownSoundOn,
  });
}

describe('useDisplayScreenSounds', () => {
  let playSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    playSpy = vi.spyOn(displaySounds, 'play').mockImplementation(() => {});
    vi.mocked(fireConfetti).mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('plays the table sound on a live forward move, without confetti', () => {
    moveForward(frame('round_overview', 1), frame('round_title', 2));

    expect(playSpy).toHaveBeenCalledExactlyOnceWith('sting');
    expect(fireConfetti).not.toHaveBeenCalled();
  });

  it('plays nothing for the first screen it sees', () => {
    renderHook(() =>
      useDisplayScreenSounds(
        frame('round_title', 2),
        true,
        { current: false },
        true,
      ),
    );

    expect(playSpy).not.toHaveBeenCalled();
  });

  it('plays nothing for a move the table keeps silent', () => {
    moveForward(frame('round_title', 1), frame('question', 2));

    expect(playSpy).not.toHaveBeenCalled();
  });

  it('plays nothing while the display is not connected', () => {
    moveForward(frame('round_overview', 1), frame('round_title', 2), {
      isConnected: false,
    });

    expect(playSpy).not.toHaveBeenCalled();
  });

  it('plays the fanfare and fires confetti when the quiz ends', () => {
    moveForward(frame('reveal', 1), frame('ended', 2));

    expect(playSpy).toHaveBeenCalledExactlyOnceWith('fanfare');
    expect(fireConfetti).toHaveBeenCalledTimes(1);
  });

  it('skips both when the final leaderboard already crowned a winner live', () => {
    moveForward(frame('reveal', 1), frame('ended', 2), { celebrated: true });

    expect(playSpy).not.toHaveBeenCalled();
    expect(fireConfetti).not.toHaveBeenCalled();
  });

  it('does not let a celebrated winner silence other sounds', () => {
    moveForward(frame('round_overview', 1), frame('round_title', 2), {
      celebrated: true,
    });

    expect(playSpy).toHaveBeenCalledExactlyOnceWith('sting');
  });

  it('plays the joker pick time-up only with the countdown sound on', () => {
    moveForward(frame('joker_pick', 1), frame('round_title', 2), {
      isCountdownSoundOn: true,
    });
    expect(playSpy).toHaveBeenCalledExactlyOnceWith('timeUp');
  });

  it('keeps the joker pick time-up silent with the countdown sound off', () => {
    moveForward(frame('joker_pick', 1), frame('round_title', 2), {
      isCountdownSoundOn: false,
    });
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('does not let the countdown sound setting silence other screens', () => {
    moveForward(frame('round_overview', 1), frame('round_title', 2), {
      isCountdownSoundOn: false,
    });
    expect(playSpy).toHaveBeenCalledExactlyOnceWith('sting');
  });
});
