import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { progress, socketResult } from './test-utils';

const { mockUseGameSocket, searchParamsRef, routerRef } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
  routerRef: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => routerRef,
}));

describe('PlayPage — join and reconnect', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    routerRef.push.mockReset();
    routerRef.replace.mockReset();
    mockUseGameSocket.mockReturnValue(socketResult());
  });

  it('shows a join form asking for a team name and a game code', () => {
    render(<PlayPage />);
    expect(screen.getByRole('textbox', { name: /team name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /game code/i })).toBeInTheDocument();
  });

  it('stores the team name and game code and switches to the game view after joining', async () => {
    render(<PlayPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /team name/i }), 'The Quizzards');
    await userEvent.type(screen.getByRole('textbox', { name: /game code/i }), 'ABCDEF');
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    expect(window.localStorage.getItem('campus-pubquiz-team-name')).toBe('The Quizzards');
    expect(window.localStorage.getItem('campus-pubquiz-join-code')).toBe('ABCDEF');
    expect(screen.getByText(/playing as the quizzards/i)).toBeInTheDocument();
  });

  it('calls joinTeam with the trimmed name and normalized game code when submitting', async () => {
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue(socketResult({ joinTeam }));
    render(<PlayPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /team name/i }), '  The Quizzards  ');
    await userEvent.type(screen.getByRole('textbox', { name: /game code/i }), ' abcdef ');
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    expect(joinTeam).toHaveBeenCalledWith('The Quizzards', { joinCode: 'ABCDEF' });
  });

  it('does not join when the game code is empty', async () => {
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue(socketResult({ joinTeam }));
    render(<PlayPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /team name/i }), 'The Quizzards');
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    expect(joinTeam).not.toHaveBeenCalled();
  });

  it('prefills the game code from the ?code= query parameter (QR scan)', () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    render(<PlayPage />);

    expect(screen.getByRole('textbox', { name: /game code/i })).toHaveValue('ABCDEF');
  });

  it('passes the ?code= query parameter to the socket handshake', () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    render(<PlayPage />);

    expect(mockUseGameSocket).toHaveBeenCalledWith('players', true, 'ABCDEF', 0);
  });

  it('does not connect the socket until a join code is known', () => {
    render(<PlayPage />);

    expect(mockUseGameSocket).toHaveBeenCalledWith('players', false, undefined, 0);
  });

  it('connects the socket once a code is submitted through the join form', async () => {
    render(<PlayPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /team name/i }), 'The Quizzards');
    await userEvent.type(screen.getByRole('textbox', { name: /game code/i }), 'abcdef');
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    expect(mockUseGameSocket).toHaveBeenLastCalledWith('players', true, 'ABCDEF', 1);
  });

  it('skips the join form when a team name is already stored (reconnect)', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    render(<PlayPage />);

    expect(screen.queryByRole('textbox', { name: /team name/i })).not.toBeInTheDocument();
    expect(screen.getByText(/playing as returning team/i)).toBeInTheDocument();
  });

  it('calls joinTeam with the stored name, token and join code on reconnect', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem('campus-pubquiz-team-token', 'stored-token');
    window.localStorage.setItem('campus-pubquiz-join-code', 'ABCDEF');
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue(socketResult({ joinTeam }));

    render(<PlayPage />);

    expect(joinTeam).toHaveBeenCalledWith('Returning Team', {
      teamToken: 'stored-token',
      joinCode: 'ABCDEF',
    });
  });

  it('resends joinTeam with a corrected team code when retrying with the same name and game code', async () => {
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue(socketResult({ joinTeam }));
    const { rerender } = render(<PlayPage />);

    await userEvent.type(screen.getByRole('textbox', { name: /team name/i }), 'The Quizzards');
    await userEvent.type(screen.getByRole('textbox', { name: /game code/i }), 'abcdef');
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    mockUseGameSocket.mockReturnValue(
      socketResult({ joinTeam, connectionError: 'Team name taken — enter its team code' }),
    );
    rerender(<PlayPage />);
    joinTeam.mockClear();

    await userEvent.type(screen.getByRole('textbox', { name: /team code/i }), 'quick-jade-fox');
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    expect(joinTeam).toHaveBeenCalledWith('The Quizzards', {
      joinCode: 'ABCDEF',
      teamCode: 'quick-jade-fox',
    });
  });

  it('re-joins with the stored name, token and join code when the game returns to the lobby', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem('campus-pubquiz-team-token', 'stored-token');
    window.localStorage.setItem('campus-pubquiz-join-code', 'ABCDEF');
    const joinTeam = vi.fn();
    const joinedTeam = {
      teamId: 'team-1',
      teamName: 'Returning Team',
      teamToken: 'stored-token',
      teamCode: 'stored-team-code',
    };
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: { progress: progress({ status: 'ended' }), currentQuestion: null },
        team: joinedTeam,
        joinTeam,
      }),
    );
    const { rerender } = render(<PlayPage />);
    joinTeam.mockClear();

    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: { progress: progress({ status: 'lobby' }), currentQuestion: null },
        team: joinedTeam,
        joinTeam,
      }),
    );
    rerender(<PlayPage />);

    expect(joinTeam).toHaveBeenCalledWith('Returning Team', {
      teamToken: 'stored-token',
      teamCode: 'stored-team-code',
      joinCode: 'ABCDEF',
    });
  });

  it('clears the session token and redirects to /play when the admin closes the session', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem('campus-pubquiz-team-token', 'stored-token');
    window.localStorage.setItem('campus-pubquiz-team-code', 'QUICK-JADE-FOX');
    window.localStorage.setItem('campus-pubquiz-join-code', 'ABCDEF');
    mockUseGameSocket.mockReturnValue(socketResult({ sessionClosed: 'ABCDEF' }));

    render(<PlayPage />);

    // Team name/code survive so the team can join another game without
    // retyping — only this session's token and join code are cleared.
    expect(window.localStorage.getItem('campus-pubquiz-team-name')).toBe('Returning Team');
    expect(window.localStorage.getItem('campus-pubquiz-team-code')).toBe('QUICK-JADE-FOX');
    expect(window.localStorage.getItem('campus-pubquiz-team-token')).toBeNull();
    expect(window.localStorage.getItem('campus-pubquiz-join-code')).toBeNull();
    expect(routerRef.push).toHaveBeenCalledWith('/play');
  });
});
