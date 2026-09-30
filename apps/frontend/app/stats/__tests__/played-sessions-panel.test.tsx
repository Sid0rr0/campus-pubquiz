import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AuthUser,
  PlayedSessionsListedPayload,
} from '@campus-pubquiz/types';
import { PlayedSessionsPanel } from '@/app/stats/played-sessions-panel';
import { StatsApiError } from '@/app/lib/stats-api';
import type { UseAuthResult } from '@/app/lib/use-auth';
import { renderWithQuery } from '@/test-utils/query';

const {
  mockFetchPlayedSessions,
  mockDeleteSession,
  mockRenameSession,
  mockUseAuth,
} = vi.hoisted(() => ({
  mockFetchPlayedSessions: vi.fn(),
  mockDeleteSession: vi.fn(),
  mockRenameSession: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('@/app/lib/stats-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/stats-api')>();
  return {
    ...actual,
    fetchPlayedSessions: mockFetchPlayedSessions,
    deleteSession: mockDeleteSession,
    renameSession: mockRenameSession,
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
    name: 'Quiz Night',
    playedAt: '2026-01-05T00:00:00.000Z',
    teamCount: 3,
    maxPoints: 20,
    winnerTeamName: 'The Quizzards',
    winnerPoints: 15,
  },
  {
    gameSessionId: 2,
    joinCode: 'GHIJKL',
    quizTitle: 'Trivia Tuesday',
    name: 'Trivia Tuesday',
    playedAt: '2026-01-01T00:00:00.000Z',
    teamCount: 0,
    maxPoints: 10,
    winnerTeamName: null,
    winnerPoints: null,
  },
];

const PAYLOAD: PlayedSessionsListedPayload = {
  items: SESSIONS,
  total: SESSIONS.length,
  page: 1,
  pageSize: 20,
};

describe('PlayedSessionsPanel', () => {
  beforeEach(() => {
    mockFetchPlayedSessions.mockReset();
    mockDeleteSession.mockReset();
    mockRenameSession.mockReset();
    mockUseAuth.mockReset();
    mockFetchPlayedSessions.mockResolvedValue(PAYLOAD);
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
    mockFetchPlayedSessions.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
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
    it('disables Prev on the first page and requests page 2 on Next', async () => {
      mockFetchPlayedSessions.mockReset();
      mockFetchPlayedSessions.mockResolvedValue({
        items: SESSIONS,
        total: 25,
        page: 1,
        pageSize: 20,
      });
      const user = userEvent.setup();
      renderWithQuery(<PlayedSessionsPanel />);
      await waitFor(() => screen.getByText('Quiz Night'));

      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled();

      mockFetchPlayedSessions.mockClear();
      await user.click(screen.getByRole('button', { name: 'Next' }));

      await waitFor(() =>
        expect(mockFetchPlayedSessions).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2 }),
          expect.anything(),
        ),
      );
    });

    it('toggles sort order on the Date header and requests it from the server', async () => {
      const user = userEvent.setup();
      renderWithQuery(<PlayedSessionsPanel />);
      await waitFor(() => screen.getByText('Quiz Night'));
      mockFetchPlayedSessions.mockClear();

      await user.click(screen.getByRole('button', { name: /date/i }));

      await waitFor(() =>
        expect(mockFetchPlayedSessions).toHaveBeenCalledWith(
          expect.objectContaining({ sortBy: 'playedAt', sortOrder: 'asc' }),
          expect.anything(),
        ),
      );
    });
  });

  async function openActionsMenu(name: string): Promise<void> {
    await userEvent.click(
      screen.getByRole('button', {
        name: new RegExp(`actions for ${name}`, 'i'),
      }),
    );
  }

  describe('delete session', () => {
    it('hides the Actions column for a non-admin', async () => {
      renderWithQuery(<PlayedSessionsPanel />);

      await waitFor(() => screen.getByText('Quiz Night'));
      expect(
        screen.queryByRole('button', { name: /actions for quiz night/i }),
      ).not.toBeInTheDocument();
    });

    it('shows a Delete action for an admin and deletes the session on confirm', async () => {
      mockUseAuth.mockReturnValue(
        authResult({ user: ADMIN_USER, status: 'authenticated' }),
      );
      mockDeleteSession.mockResolvedValue(undefined);
      renderWithQuery(<PlayedSessionsPanel />);

      await waitFor(() => screen.getByText('Quiz Night'));
      await openActionsMenu('Quiz Night');
      await userEvent.click(
        await screen.findByRole('menuitem', { name: /delete/i }),
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
      await openActionsMenu('Quiz Night');
      await userEvent.click(
        await screen.findByRole('menuitem', { name: /delete/i }),
      );
      await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

      expect(
        await screen.findByText('Deleted "Quiz Night"'),
      ).toBeInTheDocument();
    });
  });

  describe('rename session', () => {
    it('hides the Edit action for a non-admin', async () => {
      renderWithQuery(<PlayedSessionsPanel />);

      await waitFor(() => screen.getByText('Quiz Night'));
      expect(
        screen.queryByRole('button', { name: /actions for quiz night/i }),
      ).not.toBeInTheDocument();
    });

    it('shows an Edit action for an admin, prefilled with the current name', async () => {
      mockUseAuth.mockReturnValue(
        authResult({ user: ADMIN_USER, status: 'authenticated' }),
      );
      renderWithQuery(<PlayedSessionsPanel />);

      await waitFor(() => screen.getByText('Quiz Night'));
      await openActionsMenu('Quiz Night');
      await userEvent.click(
        await screen.findByRole('menuitem', { name: /edit/i }),
      );

      expect(
        screen.getByRole('heading', { name: /rename session/i }),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue('Quiz Night')).toBeInTheDocument();
    });

    it('renames the session to the edited value on save', async () => {
      mockUseAuth.mockReturnValue(
        authResult({ user: ADMIN_USER, status: 'authenticated' }),
      );
      mockRenameSession.mockResolvedValue(undefined);
      renderWithQuery(<PlayedSessionsPanel />);

      await waitFor(() => screen.getByText('Quiz Night'));
      await openActionsMenu('Quiz Night');
      await userEvent.click(
        await screen.findByRole('menuitem', { name: /edit/i }),
      );
      const nameInput = screen.getByDisplayValue('Quiz Night');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Week 3 Social');
      await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

      await waitFor(() =>
        expect(mockRenameSession).toHaveBeenCalledWith(1, 'Week 3 Social'),
      );
    });

    it('does not rename the session when the dialog is cancelled', async () => {
      mockUseAuth.mockReturnValue(
        authResult({ user: ADMIN_USER, status: 'authenticated' }),
      );
      renderWithQuery(<PlayedSessionsPanel />);

      await waitFor(() => screen.getByText('Quiz Night'));
      await openActionsMenu('Quiz Night');
      await userEvent.click(
        await screen.findByRole('menuitem', { name: /edit/i }),
      );
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockRenameSession).not.toHaveBeenCalled();
      expect(
        screen.queryByRole('heading', { name: /rename session/i }),
      ).not.toBeInTheDocument();
    });

    it('shows an error toast when the rename fails', async () => {
      mockUseAuth.mockReturnValue(
        authResult({ user: ADMIN_USER, status: 'authenticated' }),
      );
      mockRenameSession.mockRejectedValue(
        new StatsApiError('Could not rename session', 500),
      );
      renderWithQuery(
        <>
          <PlayedSessionsPanel />
          <Toaster />
        </>,
      );

      await waitFor(() => screen.getByText('Quiz Night'));
      await openActionsMenu('Quiz Night');
      await userEvent.click(
        await screen.findByRole('menuitem', { name: /edit/i }),
      );
      await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

      expect(
        await screen.findByText(/could not rename session/i),
      ).toBeInTheDocument();
    });
  });
});
