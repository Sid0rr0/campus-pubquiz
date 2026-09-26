import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayedSessionStats } from '@campus-pubquiz/types';
import { PlayedSessionsPanel } from '@/app/stats/played-sessions-panel';
import { renderWithQuery } from '@/test-utils/query';

const { mockFetchPlayedSessions } = vi.hoisted(() => ({
  mockFetchPlayedSessions: vi.fn(),
}));

vi.mock('@/app/lib/stats-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/stats-api')>();
  return { ...actual, fetchPlayedSessions: mockFetchPlayedSessions };
});

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
    mockFetchPlayedSessions.mockResolvedValue(SESSIONS);
  });

  it('lists every played session once loaded', async () => {
    renderWithQuery(<PlayedSessionsPanel />);

    await waitFor(() =>
      expect(screen.getByText('Quiz Night')).toBeInTheDocument(),
    );
    expect(screen.getByText('Trivia Tuesday')).toBeInTheDocument();
    expect(screen.getByText('15 — The Quizzards')).toBeInTheDocument();
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
});
