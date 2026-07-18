import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameProgress, QuestionView } from '@campus-pubquiz/types';
import DisplayPage from '@/app/display/page';

const { mockUseGameSocket, searchParamsRef } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title?: string }) => (
    <svg role="img" aria-label={title} data-testid="qr-code" data-value={value} />
  ),
}));

function progress(overrides: Partial<GameProgress> = {}): GameProgress {
  return {
    status: 'lobby',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    ...overrides,
  };
}

const question: QuestionView = {
  id: 'r1q1',
  type: 'multiple_choice',
  prompt: 'Capital of France?',
  options: ['Paris', 'London'],
  points: 2,
};

describe('DisplayPage', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams();
  });

  it('renders a picture question as an image', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: {
          id: 'r2q1',
          type: 'picture',
          prompt: 'Which landmark is shown?',
          mediaUrl: 'https://example.com/landmark.jpg',
          points: 3,
        },
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('src', 'https://example.com/landmark.jpg');
    expect(screen.queryByTestId('question-audio')).not.toBeInTheDocument();
  });

  it('renders an audio question as an autoplaying audio player, not an image', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: {
          id: 'r2q2',
          type: 'audio',
          prompt: 'Name this song.',
          mediaUrl: 'https://example.com/song.mp3',
          points: 3,
        },
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    const audio = screen.getByTestId('question-audio');
    expect(audio).toHaveAttribute('src', 'https://example.com/song.mp3');
    expect(audio).toHaveAttribute('autoplay');
    expect(audio).toHaveAttribute('controls');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows a connecting message before the first snapshot arrives', () => {
    mockUseGameSocket.mockReturnValue({ snapshot: null, connectionError: null, sendAction: vi.fn() });
    render(<DisplayPage />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('shows a waiting message in the lobby', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
  });

  it('shows a join QR code and the join code in the lobby', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'lobby' }),
        currentQuestion: null,
        joinCode: 'ABCDEF',
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('qr-code')).toHaveAttribute(
      'data-value',
      `${window.location.origin}/play?code=ABCDEF`,
    );
    expect(screen.getByText('ABCDEF')).toBeInTheDocument();
  });

  it('prefers the join code from the ?code= query parameter over the snapshot', () => {
    searchParamsRef.current = new URLSearchParams('code=GHIJKL');
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'lobby' }),
        currentQuestion: null,
        joinCode: 'ABCDEF',
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('qr-code')).toHaveAttribute(
      'data-value',
      `${window.location.origin}/play?code=GHIJKL`,
    );
    expect(screen.getByText('GHIJKL')).toBeInTheDocument();
  });

  it('shows the connected team names scattered across the lobby screen', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'lobby' }),
        currentQuestion: null,
        joinCode: 'ABCDEF',
        teams: [
          { teamId: 'team-1', teamName: 'The Quizzards' },
          { teamId: 'team-2', teamName: 'Beer Necessities' },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    const first = screen.getByText('The Quizzards');
    expect(first).toBeInTheDocument();
    expect(screen.getByText('Beer Necessities')).toBeInTheDocument();
    // scattered = absolutely positioned with per-team inline coordinates
    expect(first.style.left).toMatch(/%$/);
    expect(first.style.top).toMatch(/%$/);
  });

  it('does not show the connected team names outside the lobby', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: question,
        joinCode: 'ABCDEF',
        teams: [{ teamId: 'team-1', teamName: 'The Quizzards' }],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.queryByText('The Quizzards')).not.toBeInTheDocument();
  });

  it('does not show the join QR code outside the lobby', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: question,
        joinCode: 'ABCDEF',
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
  });

  it('shows the current question and its options while open', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'question_open' }), currentQuestion: question },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText('Capital of France?')).toBeInTheDocument();
    expect(screen.getByText('Paris')).toBeInTheDocument();
    expect(screen.getByText('London')).toBeInTheDocument();
  });

  it('shows how many teams have answered the open question', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open' }),
        currentQuestion: question,
        teams: [
          { teamId: 'team-1', teamName: 'The Quizzards' },
          { teamId: 'team-2', teamName: 'Beer Necessities' },
        ],
        answeredTeamIds: ['team-1'],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText(/1 of 2 teams answered/i)).toBeInTheDocument();
  });

  it('shows a grading message during a break', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'break' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText(/grading/i)).toBeInTheDocument();
  });

  it('shows a completion message once the quiz has ended', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: { progress: progress({ status: 'ended' }), currentQuestion: null },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText(/complete/i)).toBeInTheDocument();
  });

  it('shows the leaderboard overlay whenever isLeaderboardVisible is true, regardless of status', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'question_open', isLeaderboardVisible: true }),
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
          { teamId: 'team-1', teamName: 'The Quizzards', totalPoints: 5 },
          { teamId: 'team-2', teamName: 'Second Place', totalPoints: 3 },
        ],
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
});
