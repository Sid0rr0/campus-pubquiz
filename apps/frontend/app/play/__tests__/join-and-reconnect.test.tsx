import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { renderWithQuery } from '@/test-utils/query';
import { socketResult } from './test-utils';

const { mockUseTeamLink, mockFetchPublicSessions, searchParamsRef, routerRef } =
  vi.hoisted(() => ({
    mockUseTeamLink: vi.fn(),
    mockFetchPublicSessions: vi.fn(),
    searchParamsRef: { current: new URLSearchParams() },
    routerRef: { push: vi.fn(), replace: vi.fn() },
  }));

vi.mock('@/app/lib/use-team-link', () => ({
  useTeamLink: mockUseTeamLink,
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
  name: 'Campus Pub Quiz Night',
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
    mockUseTeamLink.mockReturnValue(socketResult());
    mockFetchPublicSessions.mockReset();
    mockFetchPublicSessions.mockResolvedValue([]);
  });

  it('shows a join form asking for a team name and a live game to join, with no raw game code field', async () => {
    mockFetchPublicSessions.mockResolvedValue([LIVE_SESSION]);
    renderWithQuery(<PlayPage />);
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

  it('hands the typed name, the picked game and the submit to the Team link', async () => {
    const setNameInput = vi.fn();
    const setCodeInput = vi.fn();
    const handleJoin = vi.fn((event) => event.preventDefault());
    mockUseTeamLink.mockReturnValue(
      socketResult({ setNameInput, setCodeInput, handleJoin }),
    );
    mockFetchPublicSessions.mockResolvedValue([LIVE_SESSION]);
    renderWithQuery(<PlayPage />);

    await userEvent.type(
      screen.getByRole('textbox', { name: /team name/i }),
      'Q',
    );
    await pickLiveSession();
    await userEvent.click(screen.getByRole('button', { name: /join/i }));

    expect(setNameInput).toHaveBeenCalledWith('Q');
    expect(setCodeInput).toHaveBeenCalledWith('ABCDEF');
    expect(handleJoin).toHaveBeenCalledTimes(1);
  });

  it('prefills the game code from the Team link (QR scan)', async () => {
    mockFetchPublicSessions.mockResolvedValue([LIVE_SESSION]);
    mockUseTeamLink.mockReturnValue(socketResult({ codeInput: 'ABCDEF' }));
    renderWithQuery(<PlayPage />);

    // The combobox exists (with a placeholder) before the session list
    // query resolves, so findByRole alone would resolve on that first
    // render — wait for the resolved list's text specifically.
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: /pick the quiz/i }),
      ).toHaveTextContent(/campus pub quiz night/i),
    );
  });

  it('passes the URL values to the Team link', () => {
    searchParamsRef.current = new URLSearchParams(
      'code=ABCDEF&teamCode=QUICK-JADE-FOX&name=Quizzards',
    );
    renderWithQuery(<PlayPage />);

    expect(mockUseTeamLink).toHaveBeenCalledWith(
      'ABCDEF',
      'QUICK-JADE-FOX',
      'Quizzards',
    );
  });

  it('shows the connecting screen while the link has a name and game but no snapshot yet (reconnect)', () => {
    mockUseTeamLink.mockReturnValue(
      socketResult({ teamName: 'Returning Team', activeJoinCode: 'ABCDEF' }),
    );
    renderWithQuery(<PlayPage />);

    expect(
      screen.queryByRole('textbox', { name: /team name/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/playing as returning team/i)).toBeInTheDocument();
    expect(screen.getByText(/connecting…/i)).toBeInTheDocument();
  });

  it('shows the join form instead of hanging on "Connecting…" when a team name survives a closed session but its join code was cleared', () => {
    // A closed session deliberately keeps the team name (so the join form
    // stays prefilled) but clears the join code. Without the
    // canReachSnapshot guard in page.tsx, the restored teamName alone would
    // skip straight past the join form to the "Connecting…" screen and hang
    // there forever, since there is no join code left to open a socket with.
    mockUseTeamLink.mockReturnValue(
      socketResult({
        teamName: 'Returning Team',
        activeJoinCode: null,
        nameInput: 'Returning Team',
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByRole('textbox', { name: /team name/i })).toHaveValue(
      'Returning Team',
    );
    expect(screen.queryByText(/connecting…/i)).not.toBeInTheDocument();
  });

  it('shows the kick notice on the join form, with the name and team code emptied', () => {
    mockUseTeamLink.mockReturnValue(
      socketResult({
        connectionError: 'You were removed from this team by the quiz master',
        teamName: null,
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(
      screen.getByText(/removed from this team by the quiz master/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/team name/i)).toHaveValue('');
    expect(screen.getByLabelText(/team code/i)).toHaveValue('');
  });

  it('does not re-append a closed session code to the URL once the link dropped the team', () => {
    // After a session closes the connection's snapshot (disabled, not torn
    // down) still holds the old joinCode. With the URL now a bare /play,
    // that stale snapshot must not make the ?code= sync re-append it: the
    // sync is gated on the link still having a team name.
    const staleSession = {
      progress: { status: 'question_open' as const },
    };
    mockUseTeamLink.mockReturnValue(
      socketResult({ teamName: null, session: staleSession }),
    );
    searchParamsRef.current = new URLSearchParams();
    renderWithQuery(<PlayPage />);

    expect(routerRef.replace).not.toHaveBeenCalled();
  });

  it('keeps ?code= in the address bar in sync with the session the team landed on', () => {
    mockUseTeamLink.mockReturnValue(
      socketResult({
        teamName: 'Returning Team',
        session: {
          progress: { status: 'question_open' },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(routerRef.replace).toHaveBeenCalledWith('/play?code=ABCDEF');
  });
});
