import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DisplayPage from '@/app/display/page';
import { progress, question } from './test-utils';

const { mockUseGameSocket, searchParamsRef } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

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
          },
          {
            teamId: 'team-2',
            teamName: 'Second Place',
            totalPoints: 3,
            bonusPoints: 0,
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
          },
          {
            teamId: 'team-2',
            teamName: 'Second Place',
            totalPoints: 3,
            bonusPoints: 0,
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
