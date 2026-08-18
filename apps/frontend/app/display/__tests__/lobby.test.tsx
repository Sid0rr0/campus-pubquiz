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

describe('DisplayPage — lobby', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
  });

  it('shows a connecting message before the first snapshot arrives', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: null,
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('passes the ?code= query parameter to the socket handshake', () => {
    searchParamsRef.current = new URLSearchParams('code=GHIJKL');
    mockUseGameSocket.mockReturnValue({
      snapshot: null,
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(mockUseGameSocket).toHaveBeenCalledWith('display', true, 'GHIJKL');
  });

  it('shows a waiting message in the lobby', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'lobby' }),
        currentQuestion: null,
      },
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

  it('shows the connected team names at the bottom of the lobby screen with a join count', () => {
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

    expect(screen.getByText('The Quizzards')).toBeInTheDocument();
    expect(screen.getByText('Beer Necessities')).toBeInTheDocument();
    expect(screen.getByText('2 TEAMS JOINED')).toBeInTheDocument();
  });

  it('uses the singular "TEAM" when exactly one team has joined', () => {
    mockUseGameSocket.mockReturnValue({
      snapshot: {
        progress: progress({ status: 'lobby' }),
        currentQuestion: null,
        joinCode: 'ABCDEF',
        teams: [{ teamId: 'team-1', teamName: 'The Quizzards' }],
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('1 TEAM JOINED')).toBeInTheDocument();
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
});
