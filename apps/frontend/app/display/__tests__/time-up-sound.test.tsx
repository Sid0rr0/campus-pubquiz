import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

function showDisplay(description: SessionDescription) {
  mockUseGame.mockReturnValue({
    snapshot: roomView(SOCKET_ROOMS.DISPLAY, description),
    connectionError: null,
    sendAction: vi.fn(),
  });
}

const LOCKING: SessionDescription = {
  progress: { status: 'locking' },
  timers: { questionLockAt: 1_000 },
};
const LOCKED: SessionDescription = { progress: { status: 'break_intro' } };

describe('DisplayPage — the time-up sound', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockPlay.mockClear();
  });

  it('plays when the block locks live', () => {
    showDisplay(LOCKING);
    const { rerender } = render(<DisplayPage />);

    showDisplay(LOCKED);
    rerender(<DisplayPage />);

    expect(mockPlay).toHaveBeenCalledWith('timeUp');
  });

  it('stays silent on a display loaded after the block locked', () => {
    showDisplay(LOCKED);
    render(<DisplayPage />);

    expect(mockPlay).not.toHaveBeenCalledWith('timeUp');
  });

  it('stays silent when Previous goes back into the countdown', () => {
    showDisplay(LOCKED);
    const { rerender } = render(<DisplayPage />);

    showDisplay(LOCKING);
    rerender(<DisplayPage />);

    expect(mockPlay).not.toHaveBeenCalledWith('timeUp');
  });
});
