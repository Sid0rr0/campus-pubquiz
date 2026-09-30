import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionDetailStats } from '@campus-pubquiz/types';
import { SessionDetailPanel } from '@/app/stats/[id]/session-detail-panel';
import { renderWithQuery } from '@/test-utils/query';

const { mockFetchSessionDetail } = vi.hoisted(() => ({
  mockFetchSessionDetail: vi.fn(),
}));

vi.mock('@/app/lib/stats-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/stats-api')>();
  return { ...actual, fetchSessionDetail: mockFetchSessionDetail };
});

const DETAIL: SessionDetailStats = {
  gameSessionId: 1,
  joinCode: 'ABCDEF',
  quizTitle: 'Quiz Night',
  name: 'Quiz Night',
  playedAt: '2026-01-05T00:00:00.000Z',
  teamCount: 2,
  maxPoints: 10,
  difficulty: { averagePercent: 60, label: 'Medium' },
  standings: [
    {
      rank: 1,
      rankTo: 1,
      hasLeft: false,
      isWinner: true,
      teamId: 1,
      teamName: 'Team A',
      answerPoints: 8,
      bonusPoints: 2,
      total: 10,
      correctCount: 3,
      avgResponseMs: 2500,
    },
    {
      rank: 2,
      rankTo: 2,
      hasLeft: false,
      isWinner: false,
      teamId: 2,
      teamName: 'Team B',
      answerPoints: 4,
      bonusPoints: 0,
      total: 4,
      correctCount: 1,
      avgResponseMs: null,
    },
  ],
  rounds: [
    {
      roundId: 100,
      title: 'Round 1',
      category: 'History',
      correctRate: 0.5,
      pointsPercent: 40,
    },
  ],
  questions: [
    {
      questionId: 10,
      roundTitle: 'Round 1',
      orderIndex: 0,
      prompt: 'Capital of France?',
      type: 'free_text',
      points: 5,
      answeredCount: 2,
      correctCount: 2,
      correctRate: 1,
      fastestResponseMs: 1200,
    },
    {
      questionId: 11,
      roundTitle: 'Round 1',
      orderIndex: 1,
      prompt: 'Capital of the Moon?',
      type: 'free_text',
      points: 5,
      answeredCount: 2,
      correctCount: 0,
      correctRate: 0,
      fastestResponseMs: null,
    },
  ],
  highlights: {
    hardestQuestionId: 11,
    easiestQuestionId: 10,
    hardestRoundId: 100,
    allCorrectQuestionIds: [10],
    noneCorrectQuestionIds: [11],
    fastestAnswer: { teamName: 'Team A', questionId: 10, responseMs: 1200 },
    fastestTeam: { teamName: 'Team A', avgResponseMs: 2500 },
    bonus: {
      total: 2,
      byCategory: { shot: 2, selfie: 0, custom: 0 },
      count: 1,
    },
    winningMargin: 6,
  },
};

describe('SessionDetailPanel', () => {
  beforeEach(() => {
    mockFetchSessionDetail.mockReset();
    mockFetchSessionDetail.mockResolvedValue(DETAIL);
  });

  it('renders the header, highlight tiles, and tables once loaded', async () => {
    renderWithQuery(<SessionDetailPanel gameSessionId={1} />);

    await waitFor(() =>
      expect(screen.getByText('Quiz Night')).toBeInTheDocument(),
    );
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getAllByText('Team A').length).toBeGreaterThan(0);
    expect(screen.getByText('Team B')).toBeInTheDocument();
    expect(screen.getAllByText('Round 1').length).toBeGreaterThan(0);
    expect(screen.getByText('Capital of France?')).toBeInTheDocument();
    expect(screen.getAllByText('Capital of the Moon?').length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole('link', { name: '← Back to stats' }),
    ).toHaveAttribute('href', '/stats');
  });

  it("shows 'Not recorded' for a team with no timed answers", async () => {
    renderWithQuery(<SessionDetailPanel gameSessionId={1} />);

    await waitFor(() => screen.getByText('Team B'));
    expect(screen.getAllByText('Not recorded').length).toBeGreaterThan(0);
  });

  it('shows an error alert when the fetch fails', async () => {
    mockFetchSessionDetail.mockReset();
    mockFetchSessionDetail.mockRejectedValue(
      new Error('Could not load session detail'),
    );
    renderWithQuery(<SessionDetailPanel gameSessionId={1} />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not load session detail',
      ),
    );
  });
});
