import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { progress, socketResult } from './test-utils';

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

describe('PlayPage — logout and errors', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseGameSocket.mockReturnValue(socketResult());
  });

  it('shows the join error directly on the join form, pre-filled, when a returning team reconnect fails', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem('campus-pubquiz-join-code', 'STALE1');
    window.localStorage.setItem('campus-pubquiz-team-token', 'stored-token');
    mockUseGameSocket.mockReturnValue(
      socketResult({ connectionError: 'Invalid join code' }),
    );
    render(<PlayPage />);

    expect(screen.getByText(/invalid join code/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /team name/i })).toHaveValue('Returning Team');
    expect(screen.getByRole('textbox', { name: /game code/i })).toHaveValue('STALE1');

    await userEvent.click(screen.getByRole('button', { name: /log out/i }));

    // Team name survives logout — the form stays prefilled for playing as
    // this team again — but the stale join code for this game is cleared.
    expect(screen.getByRole('textbox', { name: /team name/i })).toHaveValue('Returning Team');
    expect(window.localStorage.getItem('campus-pubquiz-team-name')).toBe('Returning Team');
    expect(window.localStorage.getItem('campus-pubquiz-join-code')).toBeNull();
  });

  it('does not offer a "Log out" button when a fresh join fails because the name collides with an existing team', async () => {
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue(socketResult({ joinTeam }));
    const { rerender } = render(<PlayPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /team name/i }), 'Taken Name');
    await userEvent.type(screen.getByRole('textbox', { name: /game code/i }), 'ABCDEF');
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    mockUseGameSocket.mockReturnValue(
      socketResult({
        joinTeam,
        connectionError:
          'Team name "Taken Name" is already registered — enter its team code to play as this team, or choose a different name',
      }),
    );
    rerender(<PlayPage />);

    expect(screen.getByText(/already registered/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
  });

  it('lets a joined team log out from the game view, clearing storage and returning to the join form', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem('campus-pubquiz-team-token', 'stored-token');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'question_open' }),
          currentQuestion: { id: 'r1q1', type: 'free_text', prompt: 'Name a fruit', points: 1 },
        },
        team: { teamId: 'team-1', teamName: 'Returning Team', teamToken: 'team-token-1' },
      }),
    );
    render(<PlayPage />);

    await userEvent.click(screen.getByRole('button', { name: /log out/i }));

    expect(screen.getByRole('textbox', { name: /team name/i })).toBeInTheDocument();
    // The team's token (this specific game session's auth) is cleared, but
    // its name is kept so the team can rejoin another game without retyping.
    expect(window.localStorage.getItem('campus-pubquiz-team-name')).toBe('Returning Team');
    expect(window.localStorage.getItem('campus-pubquiz-team-token')).toBeNull();
  });

  it('prefills the team code field after logging out following a fresh join (server-issued code)', async () => {
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue(socketResult({ joinTeam }));
    const { rerender } = render(<PlayPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /team name/i }), 'The Quizzards');
    await userEvent.type(screen.getByRole('textbox', { name: /game code/i }), 'ABCDEF');
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    mockUseGameSocket.mockReturnValue(
      socketResult({
        joinTeam,
        team: { teamId: 'team-1', teamName: 'The Quizzards', teamToken: 'token-1', teamCode: 'QUICK-JADE-FOX' },
      }),
    );
    rerender(<PlayPage />);

    await userEvent.click(screen.getByRole('button', { name: /log out/i }));

    expect(screen.getByRole('textbox', { name: /team code/i })).toHaveValue('QUICK-JADE-FOX');
  });
});
