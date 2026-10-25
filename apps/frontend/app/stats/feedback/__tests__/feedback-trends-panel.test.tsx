import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedbackTrends } from '@campus-pubquiz/types';
import { FeedbackTrendsPanel } from '@/app/stats/feedback/feedback-trends-panel';
import { StatsApiError } from '@/app/lib/stats-api';
import { renderWithQuery } from '@/test-utils/query';

const { mockFetchFeedbackTrends, mockFetchLeagues } = vi.hoisted(() => ({
  mockFetchFeedbackTrends: vi.fn(),
  mockFetchLeagues: vi.fn(),
}));

vi.mock('@/app/lib/leagues-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/leagues-api')>();
  return { ...actual, fetchLeagues: mockFetchLeagues };
});

vi.mock('@/app/lib/stats-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/stats-api')>();
  return { ...actual, fetchFeedbackTrends: mockFetchFeedbackTrends };
});

const TRENDS: FeedbackTrends = {
  sessions: [
    {
      id: 1,
      name: 'Autumn quiz',
      date: '2026-09-01T19:00:00.000Z',
      rating: { average: 4.25, count: 8 },
      pacing: { too_slow: 2, just_right: 7, too_fast: 1 },
      feltDifficulty: { too_easy: 0, just_right: 5, too_hard: 3 },
    },
    {
      id: 2,
      name: 'Winter quiz',
      date: '2026-12-01T19:00:00.000Z',
      rating: null,
      pacing: { too_slow: 0, just_right: 0, too_fast: 0 },
      feltDifficulty: { too_easy: 0, just_right: 0, too_hard: 0 },
    },
  ],
  topics: [{ topic: 'Geography', count: 4 }],
  bestRounds: [
    {
      sessionId: 1,
      sessionName: 'Spring quiz',
      roundTitle: 'Music round',
      average: 4.75,
      count: 6,
    },
  ],
  worstRounds: [
    {
      sessionId: 2,
      sessionName: 'Summer quiz',
      roundTitle: 'Geography round',
      average: 2.1,
      count: 4,
    },
  ],
};

describe('FeedbackTrendsPanel', () => {
  beforeEach(() => {
    mockFetchFeedbackTrends.mockReset();
    mockFetchFeedbackTrends.mockResolvedValue(TRENDS);
    mockFetchLeagues.mockReset();
    mockFetchLeagues.mockResolvedValue({ items: [] });
  });

  it('lists each session with its average rating and rating count', async () => {
    renderWithQuery(<FeedbackTrendsPanel />);

    const row = (await screen.findByText('Autumn quiz')).closest('tr')!;
    const cells = within(row).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('★ 4.3');
    expect(cells[3]).toHaveTextContent('8');
  });

  it('shows pacing and felt difficulty counts in scale order', async () => {
    renderWithQuery(<FeedbackTrendsPanel />);

    expect(
      await screen.findByRole('columnheader', { name: 'Pacing' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Felt difficulty' }),
    ).toBeInTheDocument();
    const row = screen.getByText('Autumn quiz').closest('tr')!;
    const cells = within(row).getAllByRole('cell');
    expect(cells[4]).toHaveTextContent('2 · 7 · 1');
    expect(cells[5]).toHaveTextContent('0 · 5 · 3');
  });

  it('shows a dash, not zero, for a session nobody rated', async () => {
    renderWithQuery(<FeedbackTrendsPanel />);

    const row = (await screen.findByText('Winter quiz')).closest('tr')!;
    const cells = within(row).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('—');
    expect(cells[3]).toHaveTextContent('—');
    expect(cells[4]).toHaveTextContent('—');
    expect(cells[5]).toHaveTextContent('—');
  });

  it('writes out an empty state when no session is in range', async () => {
    mockFetchFeedbackTrends.mockResolvedValue({
      sessions: [],
      topics: [],
      bestRounds: [],
      worstRounds: [],
    });
    renderWithQuery(<FeedbackTrendsPanel />);

    expect(
      await screen.findByText(
        'No finished sessions with feedback in this range.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the topic suggestions with their counts', async () => {
    renderWithQuery(<FeedbackTrendsPanel />);

    expect(await screen.findByText('Geography ×4')).toBeInTheDocument();
  });

  it('lists the best and worst rounds with their session, average and count', async () => {
    renderWithQuery(<FeedbackTrendsPanel />);

    const best = (await screen.findByText('Music round')).closest('li')!;
    expect(best).toHaveTextContent('Spring quiz');
    expect(best).toHaveTextContent('★ 4.8 · 6 ratings');
    const worst = screen.getByText('Geography round').closest('li')!;
    expect(worst).toHaveTextContent('Summer quiz');
    expect(worst).toHaveTextContent('★ 2.1 · 4 ratings');
  });

  it('lists two same-titled rounds of one session separately, without a duplicate key', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const round = {
      sessionId: 1,
      sessionName: 'Spring quiz',
      roundTitle: 'Picture round',
      count: 5,
    };
    mockFetchFeedbackTrends.mockResolvedValue({
      ...TRENDS,
      bestRounds: [
        { ...round, average: 4.5 },
        { ...round, average: 4.2 },
      ],
    });
    renderWithQuery(<FeedbackTrendsPanel />);

    expect(await screen.findAllByText('Picture round')).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('writes out "Not enough ratings yet" for empty round lists', async () => {
    mockFetchFeedbackTrends.mockResolvedValue({
      ...TRENDS,
      bestRounds: [],
      worstRounds: [],
    });
    renderWithQuery(<FeedbackTrendsPanel />);

    expect(await screen.findAllByText('Not enough ratings yet')).toHaveLength(
      2,
    );
  });

  it('asks for all time first, then for the chosen range', async () => {
    const user = userEvent.setup();
    renderWithQuery(<FeedbackTrendsPanel />);
    await screen.findByText('Autumn quiz');
    expect(mockFetchFeedbackTrends).toHaveBeenLastCalledWith(
      { from: '', to: '' },
      expect.anything(),
    );

    await user.type(screen.getByLabelText('From'), '2026-09-01');

    await waitFor(() =>
      expect(mockFetchFeedbackTrends).toHaveBeenLastCalledWith(
        { from: '2026-09-01', to: '' },
        expect.anything(),
      ),
    );
  });

  it('switches from a date range to a league and back', async () => {
    mockFetchLeagues.mockResolvedValue({
      items: [{ id: 7, name: 'Autumn league', sessions: [] }],
    });
    const user = userEvent.setup();
    renderWithQuery(<FeedbackTrendsPanel />);
    await screen.findByText('Autumn quiz');
    await user.type(screen.getByLabelText('From'), '2026-09-01');

    await user.selectOptions(
      await screen.findByLabelText('League'),
      'Autumn league',
    );

    await waitFor(() =>
      expect(mockFetchFeedbackTrends).toHaveBeenLastCalledWith(
        { from: '2026-09-01', to: '', leagueId: 7 },
        expect.anything(),
      ),
    );
    expect(screen.getByLabelText('From')).toBeDisabled();
    expect(screen.getByLabelText('To')).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('League'), 'Date range');

    await waitFor(() =>
      expect(mockFetchFeedbackTrends).toHaveBeenLastCalledWith(
        { from: '2026-09-01', to: '' },
        expect.anything(),
      ),
    );
    expect(screen.getByLabelText('From')).toBeEnabled();
  });

  it('shows the error when loading fails', async () => {
    mockFetchFeedbackTrends.mockRejectedValue(
      new StatsApiError('Invalid query', 400),
    );
    renderWithQuery(<FeedbackTrendsPanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid query');
  });
});
