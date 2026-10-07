import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import DisplayPage from '@/app/display/page';
import { roomView } from '@/test-utils/room-view';

const { mockUseGame, searchParamsRef } = vi.hoisted(() => ({
  mockUseGame: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-display-game', () => ({
  useDisplayGame: mockUseGame,
}));

// AnimatePresence's exit transition never resolves synchronously across
// rapid rerender() calls in jsdom (it waits on real animation-frame timing).
// Only one test in this file rerenders through several screens in a row to
// simulate a live socket update sequence; replacing AnimatePresence with a
// passthrough there swaps content on key change immediately, same as every
// other test in this file already gets from a single static render.
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

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title?: string }) => (
    <svg
      role="img"
      aria-label={title}
      data-testid="qr-code"
      data-value={value}
    />
  ),
}));

describe('DisplayPage — completion and leaderboard', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
  });

  it('shows a completion message once the quiz has ended', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        progress: { status: 'ended' },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText(/complete/i)).toBeInTheDocument();
  });

  it('shows the leaderboard overlay whenever isLeaderboardVisible is true, regardless of status', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        progress: { status: 'question_open', isLeaderboardVisible: true },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument();
  });

  it('renders leaderboard entries in ranked order when visible', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        progress: { isLeaderboardVisible: true },
        leaderboard: [
          { teamName: 'The Quizzards', totalPoints: 5 },
          { teamName: 'Second Place', totalPoints: 3 },
        ],
        leaderboardRevealCount: 2,
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    const entries = screen.getAllByRole('listitem');
    expect(entries[0]).toHaveTextContent('The Quizzards');
    expect(entries[0]).toHaveTextContent('5');
    expect(entries[1]).toHaveTextContent('Second Place');
    expect(entries[1]).toHaveTextContent('3');
  });

  it('only shows teams revealed so far, bottom-up, while more remain hidden', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        progress: { isLeaderboardVisible: true },
        leaderboard: [
          { teamName: 'The Quizzards', totalPoints: 5 },
          { teamName: 'Second Place', totalPoints: 3 },
        ],
        leaderboardRevealCount: 1,
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Second Place')).toBeInTheDocument();
    expect(screen.queryByText('The Quizzards')).not.toBeInTheDocument();
  });

  const SIX_TEAMS = Array.from({ length: 6 }, (_, index) => ({
    teamName: `Team ${index + 1}`,
    totalPoints: 6 - index,
  }));

  const kahootRound = { kahootMode: true, questions: [{}, {}] };

  it('caps the leaderboard to the top 5 while a kahoot round is active', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [kahootRound],
        progress: { isLeaderboardVisible: true },
        leaderboard: SIX_TEAMS,
        leaderboardRevealCount: 6,
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    for (let index = 1; index <= 5; index += 1) {
      expect(screen.getByText(`Team ${index}`)).toBeInTheDocument();
    }
    expect(screen.queryByText('Team 6')).not.toBeInTheDocument();
  });

  it('reaches ranks 1-2 with the realistic reveal count the backend actually sends (capped at 5, not the full roster)', () => {
    // Regression test: computeLeaderboardRevealCount caps revealCount at
    // min(KAHOOT_LEADERBOARD_TOP_N, leaderboard.length) — 5 here, not 6 —
    // for the Kahoot between-questions leaderboard's immediate full reveal.
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [kahootRound],
        progress: { isLeaderboardVisible: true },
        leaderboard: SIX_TEAMS,
        leaderboardRevealCount: 5,
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    for (let index = 1; index <= 5; index += 1) {
      expect(screen.getByText(`Team ${index}`)).toBeInTheDocument();
    }
    expect(screen.queryByText('Team 6')).not.toBeInTheDocument();
  });

  it('opens the between-questions leaderboard on the pre-grading total, not the already-graded one, so the count-up has something to animate', () => {
    // Regression test: a kahootMode question's points land at the
    // locking->reveal transition (ensureKahootSpeedScored on the backend),
    // before isLeaderboardVisible flips true for the between-questions
    // board. If the frontend captured "the last snapshot while hidden" as
    // its old-state baseline, it would grab the *already-graded* totals
    // from the 'reveal' screen instead of the true pre-grading ones — old
    // and new would be identical, and the animation would have nothing to
    // count up.
    const PRE_GRADING_LEADERBOARD = [
      { teamName: 'The Quizzards', totalPoints: 10 },
    ];
    const POST_GRADING_LEADERBOARD = [
      { teamName: 'The Quizzards', totalPoints: 30 },
    ];

    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [kahootRound],
        progress: { status: 'locking' },
        leaderboard: PRE_GRADING_LEADERBOARD,
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    const { rerender } = render(<DisplayPage />);

    // Grading happens here, on the 'reveal' screen — leaderboard already
    // updated, but isLeaderboardVisible is still false.
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [kahootRound],
        progress: { status: 'reveal' },
        leaderboard: POST_GRADING_LEADERBOARD,
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    rerender(<DisplayPage />);

    // The next question opens behind the between-questions leaderboard.
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [kahootRound],
        progress: {
          status: 'question_open',
          questionIndex: 1,
          // Every kahoot question is its own block, so it is block position 0.
          furthestOpenIndex: 0,
          isLeaderboardVisible: true,
        },
        leaderboard: POST_GRADING_LEADERBOARD,
        leaderboardRevealCount: 1,
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    rerender(<DisplayPage />);

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.queryByText('30')).not.toBeInTheDocument();
  });

  it('shows every team when the current round is not kahoot mode', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        progress: { isLeaderboardVisible: true },
        leaderboard: SIX_TEAMS,
        leaderboardRevealCount: 6,
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Team 6')).toBeInTheDocument();
  });
});
