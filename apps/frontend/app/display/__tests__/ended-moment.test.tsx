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

  it('puts the podium above the "Quiz complete!" heading', () => {
    showDisplay(ENDED);
    render(<DisplayPage />);

    const podium = screen.getByTestId('podium');
    const heading = screen.getByRole('heading', { name: 'Quiz complete!' });

    expect(
      podium.compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('gives each podium step its own colour', () => {
    showDisplay(ENDED);
    render(<DisplayPage />);

    const steps = within(screen.getByTestId('podium'))
      .getAllByTestId('podium-step')
      .map((step) => step.className.match(/bg-\w+/)?.[0]);

    expect(new Set(steps).size).toBe(3);
  });

  it('lists every team below the podium with its place', () => {
    showDisplay({
      ...ENDED,
      leaderboard: [...STANDINGS, { teamName: 'Fifth Team', totalPoints: 5 }],
    });
    render(<DisplayPage />);

    const rest = within(screen.getByLabelText('Other teams'));
    expect(rest.getByText('4. Fourth Team')).toBeInTheDocument();
    expect(rest.getByText('5. Fifth Team')).toBeInTheDocument();
    expect(rest.queryByText(/Gold Team/)).not.toBeInTheDocument();
  });

  it('shows no other-teams row when the podium holds every team', () => {
    showDisplay({ ...ENDED, leaderboard: STANDINGS.slice(0, 3) });
    render(<DisplayPage />);

    expect(screen.queryByLabelText('Other teams')).not.toBeInTheDocument();
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
