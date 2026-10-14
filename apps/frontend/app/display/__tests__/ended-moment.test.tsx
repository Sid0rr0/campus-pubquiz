import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import DisplayPage from '@/app/display/page';
import { roomView, type SessionDescription } from '@/test-utils/room-view';

const { mockUseGame, searchParamsRef, mockFireConfetti, mockPlay } = vi.hoisted(
  () => ({
    mockUseGame: vi.fn(),
    searchParamsRef: { current: new URLSearchParams() },
    mockFireConfetti: vi.fn(),
    mockPlay: vi.fn(),
  }),
);

vi.mock('@/app/lib/use-display-game', () => ({
  useDisplayGame: mockUseGame,
}));

vi.mock('@/app/lib/confetti', () => ({ fireConfetti: mockFireConfetti }));

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

const STANDINGS = [
  { teamName: 'Gold Team', totalPoints: 40 },
  { teamName: 'Silver Team', totalPoints: 30 },
  { teamName: 'Bronze Team', totalPoints: 20 },
  { teamName: 'Fourth Team', totalPoints: 10 },
];

function showDisplay(description: SessionDescription) {
  mockUseGame.mockReturnValue({
    snapshot: roomView(SOCKET_ROOMS.DISPLAY, description),
    connectionError: null,
    sendAction: vi.fn(),
  });
}

const ENDED: SessionDescription = {
  progress: { status: 'ended' },
  leaderboard: STANDINGS,
};
const BEFORE_END: SessionDescription = {
  progress: { status: 'reveal' },
  leaderboard: STANDINGS,
};

describe('DisplayPage — the ended moment', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockFireConfetti.mockClear();
    mockPlay.mockClear();
  });

  it('shows a podium of the top three only', () => {
    showDisplay(ENDED);
    render(<DisplayPage />);

    const podium = within(screen.getByTestId('podium'));
    expect(podium.getByText('Gold Team')).toBeInTheDocument();
    expect(podium.getByText('Bronze Team')).toBeInTheDocument();
    expect(podium.queryByText('Fourth Team')).not.toBeInTheDocument();
  });

  it('fires no confetti or fanfare on a display loaded straight into the ended screen', () => {
    showDisplay(ENDED);
    render(<DisplayPage />);

    expect(mockFireConfetti).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('fires confetti and the fanfare when the quiz ends live', () => {
    showDisplay(BEFORE_END);
    const { rerender } = render(<DisplayPage />);

    showDisplay(ENDED);
    rerender(<DisplayPage />);

    expect(mockFireConfetti).toHaveBeenCalledTimes(1);
    expect(mockPlay).toHaveBeenCalledWith('fanfare');
  });

  it('stays silent when Previous leaves the ended screen', () => {
    showDisplay(ENDED);
    const { rerender } = render(<DisplayPage />);

    showDisplay(BEFORE_END);
    rerender(<DisplayPage />);

    expect(mockFireConfetti).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });
});
