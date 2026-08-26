import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from '@/app/page';
import { renderWithQuery } from '@/test-utils/query';
import { socketResult } from './test-utils';

const {
  mockUseGameSocket,
  mockRouterPush,
  mockFetchPublicSessions,
  searchParamsRef,
} = vi.hoisted(() => ({
  mockUseGameSocket: vi.fn(),
  mockRouterPush: vi.fn(),
  mockFetchPublicSessions: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-game-socket', () => ({
  useGameSocket: mockUseGameSocket,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: mockRouterPush, replace: vi.fn() }),
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

/** The home page hides the raw game code input and offers only the live-session select — picking a game exercises the same codeInput state a typed value would. */
async function pickLiveSession() {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('combobox', { name: /pick the quiz/i }),
  );
  await user.click(
    await screen.findByRole('option', { name: /campus pub quiz night/i }),
  );
}

describe('HomePage', () => {
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
    mockUseGameSocket.mockReturnValue(socketResult());
    mockRouterPush.mockClear();
    mockFetchPublicSessions.mockReset();
    mockFetchPublicSessions.mockResolvedValue([]);
  });

  it('shows the hero heading and the how-it-works steps', () => {
    renderWithQuery(<HomePage />);

    expect(
      screen.getByRole('heading', { name: /campus pub quiz/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/enter the code/i)).toBeInTheDocument();
    expect(screen.getByText(/answer as a team/i)).toBeInTheDocument();
    expect(screen.getByText(/climb the board/i)).toBeInTheDocument();
  });

  it('shows a join form asking for a team name and a live game to join, with no raw game code field', async () => {
    mockFetchPublicSessions.mockResolvedValue([LIVE_SESSION]);
    renderWithQuery(<HomePage />);

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

  it('links to the admin login in the footer', () => {
    renderWithQuery(<HomePage />);

    expect(
      screen.getByRole('link', { name: /quiz master login/i }),
    ).toHaveAttribute('href', '/login');
  });

  it('hides the team code field until "Played before?" is clicked', async () => {
    renderWithQuery(<HomePage />);

    expect(
      screen.queryByRole('textbox', { name: /team code/i }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: /played before/i }),
    );
    expect(
      screen.getByRole('textbox', { name: /team code/i }),
    ).toBeInTheDocument();
  });

  it('reveals the team code field prefilled when a team code is already stored (returning team)', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem('campus-pubquiz-team-code', 'QUICK-JADE-FOX');
    mockUseGameSocket.mockReturnValue(
      socketResult({ connectionError: 'Session expired' }),
    );

    renderWithQuery(<HomePage />);

    expect(screen.getByRole('textbox', { name: /team code/i })).toHaveValue(
      'QUICK-JADE-FOX',
    );
  });

  it('prefills the game code from the ?code= query parameter (QR scan)', async () => {
    mockFetchPublicSessions.mockResolvedValue([LIVE_SESSION]);
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    renderWithQuery(<HomePage />);

    // The combobox exists (with a placeholder) before the session list
    // query resolves, so findByRole alone would resolve on that first
    // render — wait for the resolved list's text specifically.
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: /pick the quiz/i }),
      ).toHaveTextContent(/campus pub quiz night/i),
    );
  });

  it('shows a connecting state after submitting the join form', async () => {
    mockFetchPublicSessions.mockResolvedValue([LIVE_SESSION]);
    renderWithQuery(<HomePage />);

    await userEvent.type(
      screen.getByRole('textbox', { name: /team name/i }),
      'The Quizzards',
    );
    await pickLiveSession();
    await userEvent.click(
      screen.getByRole('button', { name: /join the quiz/i }),
    );

    expect(screen.getByText(/connecting to the table/i)).toBeInTheDocument();
  });

  it('calls joinTeam with the trimmed name, selected game code, and typed team code', async () => {
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue(socketResult({ joinTeam }));
    mockFetchPublicSessions.mockResolvedValue([LIVE_SESSION]);
    renderWithQuery(<HomePage />);

    await userEvent.type(
      screen.getByRole('textbox', { name: /team name/i }),
      '  The Quizzards  ',
    );
    await pickLiveSession();
    await userEvent.click(
      screen.getByRole('button', { name: /played before/i }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: /team code/i }),
      'quick-jade-fox',
    );
    await userEvent.click(
      screen.getByRole('button', { name: /join the quiz/i }),
    );

    expect(joinTeam).toHaveBeenCalledWith('The Quizzards', {
      joinCode: 'ABCDEF',
      teamCode: 'quick-jade-fox',
    });
  });

  it('redirects straight to /play once the team is accepted', async () => {
    const joinTeam = vi.fn();
    mockUseGameSocket.mockReturnValue(socketResult({ joinTeam }));
    mockFetchPublicSessions.mockResolvedValue([LIVE_SESSION]);
    const { rerender } = renderWithQuery(<HomePage />);

    await userEvent.type(
      screen.getByRole('textbox', { name: /team name/i }),
      'The Quizzards',
    );
    await pickLiveSession();
    await userEvent.click(
      screen.getByRole('button', { name: /join the quiz/i }),
    );

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
