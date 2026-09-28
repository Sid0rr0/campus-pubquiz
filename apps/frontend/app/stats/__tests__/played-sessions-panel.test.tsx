import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser, PlayedSessionStats } from '@campus-pubquiz/types';
import { PlayedSessionsPanel } from '@/app/stats/played-sessions-panel';
import type { UseAuthResult } from '@/app/lib/use-auth';
import { renderWithQuery } from '@/test-utils/query';

const { mockFetchPlayedSessions, mockDeleteSession, mockUseAuth } = vi.hoisted(
  () => ({
    mockFetchPlayedSessions: vi.fn(),
    mockDeleteSession: vi.fn(),
    mockUseAuth: vi.fn(),
  }),
);

vi.mock('@/app/lib/stats-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/stats-api')>();
  return {
    ...actual,
    fetchPlayedSessions: mockFetchPlayedSessions,
    deleteSession: mockDeleteSession,
  };
});

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

const ADMIN_USER: AuthUser = {
  id: 1,
  username: 'admin',
  role: 'admin',
  status: 'active',
};

function authResult(overrides: Partial<UseAuthResult> = {}): UseAuthResult {
  return {
    user: null,
    status: 'unauthenticated',
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

const SESSIONS = [
  {
    gameSessionId: 1,
    joinCode: 'ABCDEF',
    quizTitle: 'Quiz Night',
    playedAt: '2026-01-05T00:00:00.000Z',
    teamCount: 3,
    maxPoints: 20,
    winnerTeamName: 'The Quizzards',
    winnerAnswerPoints: 15,
  },
  {
    gameSessionId: 2,
    joinCode: 'GHIJKL',
    quizTitle: 'Trivia Tuesday',
    playedAt: '2026-01-01T00:00:00.000Z',
    teamCount: 0,
    maxPoints: 10,
    winnerTeamName: null,
    winnerAnswerPoints: null,
  },
];

describe('PlayedSessionsPanel', () => {
  beforeEach(() => {
    mockFetchPlayedSessions.mockReset();
    mockDeleteSession.mockReset();
    mockUseAuth.mockReset();
    mockFetchPlayedSessions.mockResolvedValue(SESSIONS);
    mockUseAuth.mockReturnValue(authResult());
  });

  it('lists every played session once loaded', async () => {
    renderWithQuery(<PlayedSessionsPanel />);

    await waitFor(() =>
      expect(screen.getByText('Quiz Night')).toBeInTheDocument(),
    );
    expect(screen.getByText('Trivia Tuesday')).toBeInTheDocument();
    expect(screen.getByText('15 — The Quizzards')).toBeInTheDocument();
  });

  it('links the quiz title to its session detail page', async () => {
    renderWithQuery(<PlayedSessionsPanel />);

    await waitFor(() => screen.getByText('Quiz Night'));
    expect(screen.getByRole('link', { name: 'Quiz Night' })).toHaveAttribute(
      'href',
      '/stats/1',
    );
  });

  it('shows a dash for a session with no teams (null winner)', async () => {
    renderWithQuery(<PlayedSessionsPanel />);

    await waitFor(() => screen.getByText('Trivia Tuesday'));
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows an empty state when no sessions have ended yet', async () => {
    mockFetchPlayedSessions.mockReset();
    mockFetchPlayedSessions.mockResolvedValue([]);
    renderWithQuery(<PlayedSessionsPanel />);

    await waitFor(() =>
      expect(screen.getByText('No finished sessions yet.')).toBeInTheDocument(),
    );
  });

  it('shows an error alert when the fetch fails', async () => {
    mockFetchPlayedSessions.mockReset();
    mockFetchPlayedSessions.mockRejectedValue(
      new Error('Could not load session stats'),
    );
    renderWithQuery(<PlayedSessionsPanel />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not load session stats',
      ),
    );
  });

  describe('pagination', () => {
    function manySessions(count: number): PlayedSessionStats[] {
      return Array.from({ length: count }, (_, index) => ({
        gameSessionId: index + 1,
        joinCode: `CODE${index}`,
        quizTitle: `Quiz ${index}`,
        playedAt: new Date(2026, 0, count - index).toISOString(),
        teamCount: 1,
        maxPoints: 10,
        winnerTeamName: 'Team A',
        winnerAnswerPoints: 5,
      }));
    }

    it('shows at most 20 rows on the first page and disables Prev', async () => {
      mockFetchPlayedSessions.mockReset();
      mockFetchPlayedSessions.mockResolvedValue(manySessions(25));
      renderWithQuery(<PlayedSessionsPanel />);

      await waitFor(() => screen.getByText('Quiz 0'));
      expect(screen.getAllByRole('row')).toHaveLength(21); // header + 20 rows
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled();
    });

    it('navigates to the next page and shows the remaining rows', async () => {
      mockFetchPlayedSessions.mockReset();
      mockFetchPlayedSessions.mockResolvedValue(manySessions(25));
      const user = userEvent.setup();
      renderWithQuery(<PlayedSessionsPanel />);
      await waitFor(() => screen.getByText('Quiz 0'));

      await user.click(screen.getByRole('button', { name: 'Next' }));

      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
      expect(screen.getAllByRole('row')).toHaveLength(6); // header + 5 rows
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    });
  });

  describe('delete session', () => {
    it('hides the Actions column for a non-admin', async () => {
      renderWithQuery(<PlayedSessionsPanel />);

      await waitFor(() => screen.getByText('Quiz Night'));
      expect(
        screen.queryByRole('button', { name: /delete quiz night/i }),
      ).not.toBeInTheDocument();
    });

    it('shows a Delete action for an admin and deletes the session on confirm', async () => {
      mockUseAuth.mockReturnValue(
        authResult({ user: ADMIN_USER, status: 'authenticated' }),
      );
      mockDeleteSession.mockResolvedValue(undefined);
      renderWithQuery(<PlayedSessionsPanel />);

      await waitFor(() => screen.getByText('Quiz Night'));
      await userEvent.click(
        screen.getByRole('button', { name: /delete quiz night/i }),
      );
      await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

      await waitFor(() => expect(mockDeleteSession).toHaveBeenCalledWith(1));
    });

    it('shows a success toast naming the session after it is deleted', async () => {
      mockUseAuth.mockReturnValue(
        authResult({ user: ADMIN_USER, status: 'authenticated' }),
      );
      mockDeleteSession.mockResolvedValue(undefined);
      renderWithQuery(
        <>
          <PlayedSessionsPanel />
          <Toaster />
        </>,
      );

      await waitFor(() => screen.getByText('Quiz Night'));
      await userEvent.click(
        screen.getByRole('button', { name: /delete quiz night/i }),
      );
      await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

      expect(
        await screen.findByText('Deleted "Quiz Night"'),
      ).toBeInTheDocument();
    });
  });
});
