import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import DisplayPage from '@/app/display/page';
import { roomView, type SessionDescription } from '@/test-utils/room-view';

const { mockUseGame, searchParamsRef, mockPlay } = vi.hoisted(() => ({
  mockUseGame: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
  mockPlay: vi.fn(),
}));

vi.mock('@/app/lib/use-display-game', () => ({
  useDisplayGame: mockUseGame,
}));

vi.mock('@/app/lib/display-sounds', () => ({
  displaySounds: { play: mockPlay, unlock: vi.fn(), setMuted: vi.fn() },
}));

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
  };
});

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

let playSpy: ReturnType<typeof vi.spyOn>;
let pauseSpy: ReturnType<typeof vi.spyOn>;

function showDisplay(description: SessionDescription) {
  mockUseGame.mockReturnValue({
    snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
      teams: [
        { teamId: 1, teamName: 'The Quizzards' },
        { teamId: 2, teamName: 'Second Place' },
      ],
      rounds: [
        { title: 'Round A', questions: [{ prompt: 'A?' }] },
        { title: 'Round B', questions: [{ prompt: 'B?' }] },
      ],
      ...description,
    }),
    connectionError: null,
    sendAction: vi.fn(),
  });
}

/** An open pick with `secondsLeft` to go, as the server sends it. */
function picking(
  secondsLeft: number,
  extra: SessionDescription = {},
): SessionDescription {
  return {
    progress: { status: 'joker_pick' },
    timers: { jokerPickEndsAt: secondsLeft * 1000 },
    ...extra,
  };
}

const AFTER_PICK: SessionDescription = {
  progress: { status: 'round_intro', roundIndex: 0 },
};

/** Taps "Enable sound", then returns how many plays the tap itself made. */
function enableSound(): number {
  fireEvent.click(screen.getByRole('button', { name: /enable sound/i }));
  return playSpy.mock.calls.length;
}

describe('DisplayPage — the joker pick sounds', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockPlay.mockClear();
    playSpy = vi
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined);
    pauseSpy = vi
      .spyOn(window.HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('the countdown track', () => {
    it('plays from the point that ends as the pick closes', () => {
      showDisplay(picking(40));
      render(<DisplayPage />);

      enableSound();

      const audio = playSpy.mock.contexts.at(-1) as HTMLAudioElement;
      expect(audio.currentTime).toBeCloseTo(20, 0);
    });

    it('stops when the pick closes early', () => {
      showDisplay(picking(40));
      const { rerender } = render(<DisplayPage />);
      enableSound();
      pauseSpy.mockClear();

      showDisplay(AFTER_PICK);
      rerender(<DisplayPage />);

      expect(pauseSpy).toHaveBeenCalled();
    });

    it('keeps playing under the join overlay', () => {
      showDisplay(picking(40));
      const { rerender } = render(<DisplayPage />);
      enableSound();
      pauseSpy.mockClear();

      showDisplay(
        picking(40, {
          progress: { status: 'joker_pick', isJoinOverlayVisible: true },
        }),
      );
      rerender(<DisplayPage />);

      expect(pauseSpy).not.toHaveBeenCalled();
    });

    it('stays silent with the countdown sound setting off', () => {
      showDisplay(picking(40, { settings: { playLockCountdownSound: false } }));
      render(<DisplayPage />);

      // Only the throwaway element that primes the browser's autoplay.
      expect(enableSound()).toBe(1);
    });

    it('stays silent while the big screen is muted', () => {
      showDisplay(picking(40, { isDisplaySoundMuted: true }));
      render(<DisplayPage />);

      expect(
        screen.queryByRole('button', { name: /enable sound/i }),
      ).toBeNull();
      expect(playSpy).not.toHaveBeenCalled();
    });
  });

  describe('the time-up sound', () => {
    it('plays once when the pick closes live', () => {
      showDisplay(picking(40));
      const { rerender } = render(<DisplayPage />);

      showDisplay(AFTER_PICK);
      rerender(<DisplayPage />);

      expect(mockPlay.mock.calls.filter(([n]) => n === 'timeUp')).toHaveLength(
        1,
      );
    });

    it('stays silent with the countdown sound setting off', () => {
      showDisplay(picking(40, { settings: { playLockCountdownSound: false } }));
      const { rerender } = render(<DisplayPage />);

      showDisplay({
        ...AFTER_PICK,
        settings: { playLockCountdownSound: false },
      });
      rerender(<DisplayPage />);

      expect(mockPlay).not.toHaveBeenCalledWith('timeUp');
    });

    it('stays silent on a display loaded after the pick closed', () => {
      showDisplay(AFTER_PICK);
      render(<DisplayPage />);

      act(() => {});
      expect(mockPlay).not.toHaveBeenCalledWith('timeUp');
    });
  });
});
