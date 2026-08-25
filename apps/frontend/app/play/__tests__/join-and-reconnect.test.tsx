import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { progress, socketResult } from './test-utils';

const {
  mockUseGameSocket,
  mockFetchPublicSessions,
  searchParamsRef,
  routerRef,
} = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  mockFetchPublicSessions: vi.fn(),
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

vi.mock('@/app/lib/sessions-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/lib/sessions-api')>();
  return { ...actual, fetchPublicSessions: mockFetchPublicSessions };
});

const LIVE_SESSION = {
  joinCode: 'ABCDEF',
  quizId: 1,
  quizTitle: 'Campus Pub Quiz Night',
  status: 'lobby' as const,
  teamCount: 0,
};

/** /play hides the raw game code input and offers only the live-session select — picking a game exercises the same codeInput state a typed value would. */
async function pickLiveSession() {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('combobox', { name: /pick the quiz/i }),
  );
  await user.click(
    await screen.findByRole('option', { name: /campus pub quiz night/i }),
  );
}

describe('PlayPage — join and reconnect', () => {
  beforeAll(() => {
    // Radix Select needs these pointer-capture APIs stubbed under jsdom.
    window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    window.HTMLElement.prototype.setPointerCapture = vi.fn();
    window.HTMLElement.prototype.releasePointerCapture = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    routerRef.push.mockReset();
    routerRef.replace.mockReset();
    mockUseGameSocket.mockReturnValue(socketResult());
    mockFetchPublicSessions.mockReset();
    mockFetchPublicSessions.mockResolvedValue([]);
  });

  it('shows a join form asking for a team name and a live game to join, with no raw game code field', async () => {
    mockFetchPublicSessions.mockResolvedValue([LIVE_SESSION]);
    render(<PlayPage />);
    expect(
      screen.getByRole('textbox', { name: /team name/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('combobox', { name: /pick the quiz/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: /game code/i }),
    ).not.toBeInTheDocument();
  });

  it('stores the team name and game code and switches to the game view after joining', async () => {
    mockFetchPublicSessions.mockResolvedValue([LIVE_SESSION]);
    render(<PlayPage />);

    await userEvent.type(
      screen.getByRole('textbox', { name: /team name/i }),
      'The Quizzards',
    );
    await pickLiveSession();
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    expect(window.localStorage.getItem('campus-pubquiz-team-name')).toBe(
      'The Quizzards',
    );
    expect(window.localStorage.getItem('campus-pubquiz-join-code')).toBe(
      'ABCDEF',
    );
    expect(screen.getByText(/playing as the quizzards/i)).toBeInTheDocument();
  });

  it('does not join when the game code is empty', async () => {
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue(socketResult({ joinTeam }));
    render(<PlayPage />);

    await userEvent.type(
      screen.getByRole('textbox', { name: /team name/i }),
      'The Quizzards',
    );
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    expect(joinTeam).not.toHaveBeenCalled();
  });

  it('prefills the game code from the ?code= query parameter (QR scan)', async () => {
    mockFetchPublicSessions.mockResolvedValue([LIVE_SESSION]);
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    render(<PlayPage />);

    expect(
      await screen.findByRole('combobox', { name: /pick the quiz/i }),
    ).toHaveTextContent(/campus pub quiz night/i);
  });

  it('passes the ?code= query parameter to the socket handshake', () => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    render(<PlayPage />);

    expect(mockUseGameSocket).toHaveBeenCalledWith(
      'players',
      true,
      'ABCDEF',
      0,
    );
  });

  it('does not connect the socket until a join code is known', () => {
    render(<PlayPage />);

    expect(mockUseGameSocket).toHaveBeenCalledWith(
      'players',
      false,
      undefined,
      0,
    );
  });

  it('connects the socket once a code is submitted through the join form', async () => {
    mockFetchPublicSessions.mockResolvedValue([LIVE_SESSION]);
    render(<PlayPage />);

    await userEvent.type(
      screen.getByRole('textbox', { name: /team name/i }),
      'The Quizzards',
    );
    await pickLiveSession();
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    expect(mockUseGameSocket).toHaveBeenLastCalledWith(
      'players',
      true,
      'ABCDEF',
      1,
    );
  });

  it('skips the join form when a team name is already stored (reconnect)', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    render(<PlayPage />);

    expect(
      screen.queryByRole('textbox', { name: /team name/i }),
    ).not.toBeInTheDocument();
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
    mockUseGameSocket.mockReturnValue(
      socketResult({ joinTeam, reconnectedAt: 1 }),
    );
    mockFetchPublicSessions.mockResolvedValue([LIVE_SESSION]);
    const { rerender } = render(<PlayPage />);

    await userEvent.type(
      screen.getByRole('textbox', { name: /team name/i }),
      'The Quizzards',
    );
    await pickLiveSession();
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    // Same connection, the server just rejects the name — reconnectedAt is
    // unchanged.
    mockUseGameSocket.mockReturnValue(
      socketResult({
        joinTeam,
        reconnectedAt: 1,
        connectionError: 'Team name taken — enter its team code',
      }),
    );
    rerender(<PlayPage />);
    joinTeam.mockClear();

    await userEvent.type(
      screen.getByRole('textbox', { name: /team code/i }),
      'quick-jade-fox',
    );
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    // Retrying forces a brand-new socket (see useTeamJoin's joinAttempt
    // comment) — simulate its connect landing, same as the real hook would
    // produce, with a fresh reconnectedAt.
    mockUseGameSocket.mockReturnValue(
      socketResult({ joinTeam, reconnectedAt: 2 }),
    );
    rerender(<PlayPage />);

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
        snapshot: {
          progress: progress({ status: 'ended' }),
          currentQuestion: null,
        },
        team: joinedTeam,
        joinTeam,
      }),
    );
    const { rerender } = render(<PlayPage />);
    joinTeam.mockClear();

    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'lobby' }),
          currentQuestion: null,
        },
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

  it('does not double-join when a page load/refresh lands directly on a lobby snapshot', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem('campus-pubquiz-team-token', 'stored-token');
    window.localStorage.setItem('campus-pubquiz-join-code', 'ABCDEF');
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue(
      socketResult({
        snapshot: {
          progress: progress({ status: 'lobby' }),
          currentQuestion: null,
        },
        joinTeam,
      }),
    );

    render(<PlayPage />);

    // A duplicate JOIN_PLAYERS here would race the old socket's disconnect
    // cleanup server-side and can wrongly bounce a refresh with "already
    // connected" — see apps/backend game.gateway.ts's one-connection-per-team
    // check.
    expect(joinTeam).toHaveBeenCalledTimes(1);
  });

  it('clears the session token and redirects to /play when the admin closes the session', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem('campus-pubquiz-team-token', 'stored-token');
    window.localStorage.setItem('campus-pubquiz-team-code', 'QUICK-JADE-FOX');
    window.localStorage.setItem('campus-pubquiz-join-code', 'ABCDEF');
    mockUseGameSocket.mockReturnValue(
      socketResult({ sessionClosed: 'ABCDEF' }),
    );

    render(<PlayPage />);

    // Team name/code survive so the team can join another game without
    // retyping — only this session's token and join code are cleared.
    expect(window.localStorage.getItem('campus-pubquiz-team-name')).toBe(
      'Returning Team',
    );
    expect(window.localStorage.getItem('campus-pubquiz-team-code')).toBe(
      'QUICK-JADE-FOX',
    );
    expect(window.localStorage.getItem('campus-pubquiz-team-token')).toBeNull();
    expect(window.localStorage.getItem('campus-pubquiz-join-code')).toBeNull();
    expect(routerRef.push).toHaveBeenCalledWith('/play');
  });

  it('does not re-append the closed session code to the URL after redirecting to /play', () => {
    // Reproduces a real closed-session socket: use-game-socket.ts only clears
    // its `snapshot` state when the socket re-enables under a *new* identity
    // (see the `if (enabled)` guard in its identity-key reset), so a live
    // session-closed transition leaves `snapshot.joinCode` stale rather than
    // null. Without the teamName guard on the ?code= sync effect, once the
    // URL actually lands on a bare /play (searchParams update following
    // routerRef.push('/play')), that stale snapshot would make the effect
    // immediately re-append `?code=ABCDEF`. Three render phases, matching
    // real timing: (1) steady-state connected with ?code= already in the URL
    // — no sync needed; (2) the admin closes the session — push('/play')
    // fires, but the URL hasn't actually changed yet in this render, so
    // codeFromUrl still equals the stale snapshot's code and no mismatch is
    // visible yet; (3) the URL catches up to the pushed /play (no code) —
    // this is the render where the stale snapshot and the now-absent
    // codeFromUrl disagree, and only the teamName guard (already nulled by
    // phase 2's render-adjustment) stops the re-append.
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem('campus-pubquiz-team-token', 'stored-token');
    window.localStorage.setItem('campus-pubquiz-join-code', 'ABCDEF');
    const staleSnapshot = {
      joinCode: 'ABCDEF',
      progress: progress({ status: 'question_open' }),
      currentQuestion: null,
    };
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    mockUseGameSocket.mockReturnValue(
      socketResult({ sessionClosed: null, snapshot: staleSnapshot }),
    );
    const { rerender } = render(<PlayPage />);
    expect(routerRef.replace).not.toHaveBeenCalled();

    mockUseGameSocket.mockReturnValue(
      socketResult({ sessionClosed: 'ABCDEF', snapshot: staleSnapshot }),
    );
    rerender(<PlayPage />);
    expect(routerRef.push).toHaveBeenCalledWith('/play');

    searchParamsRef.current = new URLSearchParams();
    rerender(<PlayPage />);

    expect(routerRef.replace).not.toHaveBeenCalled();
  });

  it('clears the session token, shows a notice and redirects to /play when the admin kicks the team', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem('campus-pubquiz-team-token', 'stored-token');
    window.localStorage.setItem('campus-pubquiz-team-code', 'QUICK-JADE-FOX');
    window.localStorage.setItem('campus-pubquiz-join-code', 'ABCDEF');
    mockUseGameSocket.mockReturnValue(
      socketResult({
        kicked: true,
        connectionError: 'You were removed from this team by the quiz master',
      }),
    );

    render(<PlayPage />);

    // Unlike a closed session, a kick deletes the roster row server-side —
    // team name and team code are wiped too (not just the token/join code),
    // so the team must fully rejoin through the form rather than silently
    // reconnecting with a now-stale identity.
    expect(window.localStorage.getItem('campus-pubquiz-team-name')).toBeNull();
    expect(window.localStorage.getItem('campus-pubquiz-team-code')).toBeNull();
    expect(window.localStorage.getItem('campus-pubquiz-team-token')).toBeNull();
    expect(window.localStorage.getItem('campus-pubquiz-join-code')).toBeNull();
    expect(routerRef.push).toHaveBeenCalledWith('/play');
    expect(
      screen.getByText(/removed from this team by the quiz master/i),
    ).toBeInTheDocument();

    const nameField = screen.getByLabelText(/team name/i);
    const teamCodeField = screen.getByLabelText(/team code/i);
    expect(nameField).toHaveValue('');
    expect(teamCodeField).toHaveValue('');
  });
});
