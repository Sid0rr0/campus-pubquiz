import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from '@/app/page';
import { socketResult } from './test-utils';

const { mockUseGameSocket, mockRouterPush, searchParamsRef } = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  mockRouterPush: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: mockRouterPush, replace: vi.fn() }),
}));

describe('HomePage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseGameSocket.mockReturnValue(socketResult());
    mockRouterPush.mockClear();
  });

  it('shows the hero heading and the how-it-works steps', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: /campus pub quiz/i })).toBeInTheDocument();
    expect(screen.getByText(/enter the code/i)).toBeInTheDocument();
    expect(screen.getByText(/answer as a team/i)).toBeInTheDocument();
    expect(screen.getByText(/climb the board/i)).toBeInTheDocument();
  });

  it('shows a join form asking for a team name and a game code', () => {
    render(<HomePage />);

    expect(screen.getByRole('textbox', { name: /team name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /game code/i })).toBeInTheDocument();
  });

  it('links to the admin login in the footer', () => {
    render(<HomePage />);

    expect(screen.getByRole('link', { name: /quiz master login/i })).toHaveAttribute('href', '/admin');
  });

  it('hides the team code field until "Played before?" is clicked', async () => {
    render(<HomePage />);

    expect(screen.queryByRole('textbox', { name: /team code/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /played before/i }));
    expect(screen.getByRole('textbox', { name: /team code/i })).toBeInTheDocument();
  });

  it('reveals the team code field prefilled when a team code is already stored (returning team)', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem('campus-pubquiz-team-code', 'QUICK-JADE-FOX');
    mockUseGameSocket.mockReturnValue(socketResult({ connectionError: 'Session expired' }));

    render(<HomePage />);

    expect(screen.getByRole('textbox', { name: /team code/i })).toHaveValue('QUICK-JADE-FOX');
  });

  it('prefills the game code from the ?code= query parameter (QR scan)', () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    render(<HomePage />);

    expect(screen.getByRole('textbox', { name: /game code/i })).toHaveValue('ABCDEF');
  });

  it('shows a connecting state after submitting the join form', async () => {
    render(<HomePage />);

    await userEvent.type(screen.getByRole('textbox', { name: /team name/i }), 'The Quizzards');
    await userEvent.type(screen.getByRole('textbox', { name: /game code/i }), 'abcdef');
    await userEvent.click(screen.getByRole('button', { name: /join the quiz/i }));

    expect(screen.getByText(/connecting to the table/i)).toBeInTheDocument();
  });

  it('calls joinTeam with the trimmed name, normalized code, and typed team code', async () => {
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue(socketResult({ joinTeam }));
    render(<HomePage />);

    await userEvent.type(screen.getByRole('textbox', { name: /team name/i }), '  The Quizzards  ');
    await userEvent.type(screen.getByRole('textbox', { name: /game code/i }), ' abcdef ');
    await userEvent.click(screen.getByRole('button', { name: /played before/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /team code/i }), 'quick-jade-fox');
    await userEvent.click(screen.getByRole('button', { name: /join the quiz/i }));

    expect(joinTeam).toHaveBeenCalledWith('The Quizzards', {
      joinCode: 'ABCDEF',
      teamCode: 'quick-jade-fox',
    });
  });

  it('redirects straight to /play once the team is accepted', async () => {
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue(socketResult({ joinTeam }));
    const { rerender } = render(<HomePage />);

    await userEvent.type(screen.getByRole('textbox', { name: /team name/i }), 'The Quizzards');
    await userEvent.type(screen.getByRole('textbox', { name: /game code/i }), 'abcdef');
    await userEvent.click(screen.getByRole('button', { name: /join the quiz/i }));

    expect(mockRouterPush).not.toHaveBeenCalled();

    mockUseGameSocket.mockReturnValue(
      socketResult({
        joinTeam,
        team: {
          teamId: 'team-1',
          teamName: 'The Quizzards',
          teamToken: 'token-1',
          teamCode: 'QUICK-JADE-FOX',
        },
        snapshot: { joinCode: 'ABCDEF' },
      }),
    );
    rerender(<HomePage />);

    expect(screen.getByText(/you're in, the quizzards/i)).toBeInTheDocument();
    expect(mockRouterPush).toHaveBeenCalledWith('/play?code=ABCDEF');
  });
});
