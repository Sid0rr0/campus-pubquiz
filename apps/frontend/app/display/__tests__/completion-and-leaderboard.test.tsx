import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import DisplayPage from '@/app/display/page';
import { progress, question } from './test-utils';

const { mockUseGameSocket, searchParamsRef } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
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
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'ended' }),
        currentQuestion: null,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText(/complete/i)).toBeInTheDocument();
  });

  it('shows the leaderboard overlay whenever isLeaderboardVisible is true, regardless of status', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({
          status: 'question_open',
          isLeaderboardVisible: true,
        }),
        currentQuestion: question,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText(/leaderboard/i)).toBeInTheDocument();
  });

  it('renders leaderboard entries in ranked order when visible', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ isLeaderboardVisible: true }),
        currentQuestion: null,
        leaderboard: [
          {
            teamId: 'team-1',
            teamName: 'The Quizzards',
            totalPoints: 5,
            bonusPoints: 0,
            roundPoints: [],
          },
          {
            teamId: 'team-2',
            teamName: 'Second Place',
            totalPoints: 3,
            bonusPoints: 0,
            roundPoints: [],
          },
        ],
        leaderboardRevealCount: 2,
      },
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
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ isLeaderboardVisible: true }),
        currentQuestion: null,
        leaderboard: [
          {
            teamId: 'team-1',
            teamName: 'The Quizzards',
            totalPoints: 5,
            bonusPoints: 0,
            roundPoints: [],
          },
          {
            teamId: 'team-2',
            teamName: 'Second Place',
            totalPoints: 3,
            bonusPoints: 0,
            roundPoints: [],
          },
        ],
        leaderboardRevealCount: 1,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Second Place')).toBeInTheDocument();
    expect(screen.queryByText('The Quizzards')).not.toBeInTheDocument();
  });

  const SIX_TEAMS = Array.from({ length: 6 }, (_, index) => ({
    teamId: `team-${index + 1}`,
    teamName: `Team ${index + 1}`,
    totalPoints: 6 - index,
    bonusPoints: 0,
    roundPoints: [],
  }));

  it('caps the leaderboard to the top 5 while a kahoot round is active', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ isLeaderboardVisible: true }),
        currentQuestion: null,
        leaderboard: SIX_TEAMS,
        leaderboardRevealCount: 6,
        isCurrentRoundKahoot: true,
      },
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
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ isLeaderboardVisible: true }),
        currentQuestion: null,
        leaderboard: SIX_TEAMS,
        leaderboardRevealCount: 5,
        isCurrentRoundKahoot: true,
      },
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
      {
        teamId: 'team-1',
        teamName: 'The Quizzards',
        totalPoints: 10,
        bonusPoints: 0,
        roundPoints: [],
      },
    ];
    const POST_GRADING_LEADERBOARD = [
      {
        teamId: 'team-1',
        teamName: 'The Quizzards',
        totalPoints: 30,
        bonusPoints: 0,
        roundPoints: [],
      },
    ];

    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'locking' }),
        currentQuestion: null,
        leaderboard: PRE_GRADING_LEADERBOARD,
        isCurrentRoundKahoot: true,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    const { rerender } = render(<DisplayPage />);

    // Grading happens here, on the 'reveal' screen — leaderboard already
    // updated, but isLeaderboardVisible is still false.
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'reveal' }),
        currentQuestion: null,
        leaderboard: POST_GRADING_LEADERBOARD,
        isCurrentRoundKahoot: true,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    rerender(<DisplayPage />);

    // The next question opens behind the between-questions leaderboard.
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({
          status: 'question_open',
          questionIndex: 1,
          isLeaderboardVisible: true,
        }),
        currentQuestion: question,
        leaderboard: POST_GRADING_LEADERBOARD,
        leaderboardRevealCount: 1,
        isCurrentRoundKahoot: true,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    rerender(<DisplayPage />);

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.queryByText('30')).not.toBeInTheDocument();
  });

  it('shows every team when the current round is not kahoot mode', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ isLeaderboardVisible: true }),
        currentQuestion: null,
        leaderboard: SIX_TEAMS,
        leaderboardRevealCount: 6,
        isCurrentRoundKahoot: false,
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Team 6')).toBeInTheDocument();
  });
});
