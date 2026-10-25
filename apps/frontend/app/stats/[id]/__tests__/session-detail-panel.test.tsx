import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionDetailStats } from '@campus-pubquiz/types';
import { SessionDetailPanel } from '@/app/stats/[id]/session-detail-panel';
import { renderWithQuery } from '@/test-utils/query';

const { mockFetchSessionDetail, mockFetchSessionBrief, mockDownloadTextFile } =
  vi.hoisted(() => ({
    mockFetchSessionDetail: vi.fn(),
    mockFetchSessionBrief: vi.fn(),
    mockDownloadTextFile: vi.fn(),
  }));

vi.mock('@/app/lib/stats-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/stats-api')>();
  return {
    ...actual,
    fetchSessionDetail: mockFetchSessionDetail,
    fetchSessionBrief: mockFetchSessionBrief,
  };
});

vi.mock('@/app/lib/download-text-file', () => ({
  downloadTextFile: mockDownloadTextFile,
}));

const DETAIL: SessionDetailStats = {
  gameSessionId: 1,
  joinCode: 'ABCDEF',
  quizTitle: 'Quiz Night',
  name: 'Quiz Night',
  playedAt: '2026-01-05T00:00:00.000Z',
  teamCount: 2,
  maxPoints: 10,
  playerCount: { total: 7, average: 3.5, reportedTeams: 2 },
  difficulty: { averagePercent: 60, label: 'Medium' },
  standings: [
    {
      rank: 1,
      rankTo: 1,
      hasLeft: false,
      isWinner: true,
      teamId: 1,
      teamName: 'Team A',
      playerCount: 4,
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
      playerCount: 3,
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
      rating: { average: 4, count: 2 },
      correctRate: 0.5,
      pointsPercent: 40,
    },
  ],
  feedback: {
    collected: true,
    comments: [
      { text: 'Too loud at the back', submittedAt: '2026-01-05T21:10:00.000Z' },
      {
        text: 'Loved the music round',
        submittedAt: '2026-01-05T21:00:00.000Z',
      },
    ],
    topics: [
      { topic: 'Geography', count: 4 },
      { topic: 'Film', count: 1 },
    ],
    rating: { average: 25 / 6, count: 37 },
  },
  questions: [
    {
      questionId: 10,
      roundId: 100,
      roundTitle: 'Round 1',
      orderIndex: 0,
      prompt: 'Capital of France?',
      type: 'free_text',
      answer: 'Paris',
      points: 5,
      answeredCount: 2,
      correctCount: 2,
      correctRate: 1,
      fastestResponseMs: 1200,
    },
    {
      questionId: 11,
      roundId: 100,
      roundTitle: 'Round 1',
      orderIndex: 1,
      prompt: 'Capital of the Moon?',
      type: 'free_text',
      answer: 'Tranquility Base',
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
    bonus: {
      total: 2,
      byCategory: { shot: 2, selfie: 0, custom: 0 },
      count: 1,
    },
    winningMargin: 6,
  },
  scoresheet: [
    {
      teamId: 1,
      questionId: 10,
      pointsAwarded: 5,
      isJoker: false,
      verdict: 'correct',
      answer: 'Paris',
    },
  ],
};

/** A highlight tile, by its label (the rounds table has a "Rating" column too). */
async function findTile(label: string): Promise<HTMLElement> {
  return (await screen.findByText(label, { selector: 'p' })).parentElement!;
}

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
    expect(screen.getAllByText('Team B').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Round 1').length).toBeGreaterThan(0);
    expect(screen.getByText('Capital of France?')).toBeInTheDocument();
    expect(screen.getAllByText('Capital of the Moon?').length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole('link', { name: '← Back to stats' }),
    ).toHaveAttribute('href', '/stats');
  });

  it('shows the hardest question with its answer, which tells repeated prompts apart', async () => {
    renderWithQuery(<SessionDetailPanel gameSessionId={1} />);

    const tile = (await screen.findByText('Hardest question')).parentElement!;
    expect(tile).toHaveTextContent('Capital of the Moon?');
    expect(tile).toHaveTextContent('Answer: Tranquility Base');
  });

  it('shows the scoresheet below the questions', async () => {
    renderWithQuery(<SessionDetailPanel gameSessionId={1} />);

    const heading = await screen.findByRole('heading', { name: 'Scoresheet' });
    expect(heading.parentElement).toHaveTextContent('Round 1');
  });

  it('shows the total players with how many teams reported, and the average team size', async () => {
    renderWithQuery(<SessionDetailPanel gameSessionId={1} />);

    await waitFor(() => screen.getByText('Total players'));
    const total = screen.getByText('Total players').closest('div')!;
    expect(within(total).getByText('7')).toBeInTheDocument();
    expect(
      within(total).getByText('2 of 2 teams reported'),
    ).toBeInTheDocument();
    const average = screen.getByText('Avg. team size').closest('div')!;
    expect(within(average).getByText('3.5')).toBeInTheDocument();
  });

  it('shows dashes for the player tiles when no team reported', async () => {
    mockFetchSessionDetail.mockResolvedValue({
      ...DETAIL,
      playerCount: { total: 0, average: null, reportedTeams: 0 },
    });
    renderWithQuery(<SessionDetailPanel gameSessionId={1} />);

    await waitFor(() => screen.getByText('Total players'));
    const total = screen.getByText('Total players').closest('div')!;
    expect(within(total).getByText('—')).toBeInTheDocument();
    expect(
      within(total).getByText('0 of 2 teams reported'),
    ).toBeInTheDocument();
    const average = screen.getByText('Avg. team size').closest('div')!;
    expect(within(average).getByText('—')).toBeInTheDocument();
  });

  it('shows the session rating with how many ratings it is made of', async () => {
    renderWithQuery(<SessionDetailPanel gameSessionId={1} />);

    const tile = await findTile('Rating');
    expect(within(tile).getByText('★ 4.2')).toBeInTheDocument();
    expect(within(tile).getByText('37 ratings')).toBeInTheDocument();
  });

  it('counts a single rating in the singular', async () => {
    mockFetchSessionDetail.mockResolvedValue({
      ...DETAIL,
      feedback: { ...DETAIL.feedback, rating: { average: 5, count: 1 } },
    });
    renderWithQuery(<SessionDetailPanel gameSessionId={1} />);

    const tile = await findTile('Rating');
    expect(within(tile).getByText('★ 5.0')).toBeInTheDocument();
    expect(within(tile).getByText('1 rating')).toBeInTheDocument();
  });

  it('shows a dash for the rating when nobody rated', async () => {
    mockFetchSessionDetail.mockResolvedValue({
      ...DETAIL,
      feedback: { ...DETAIL.feedback, rating: null },
    });
    renderWithQuery(<SessionDetailPanel gameSessionId={1} />);

    const tile = await findTile('Rating');
    expect(tile).toHaveTextContent(/^Rating—$/);
  });

  it('says feedback was off on the rating tile when it was off', async () => {
    mockFetchSessionDetail.mockResolvedValue({
      ...DETAIL,
      feedback: { collected: false, comments: [], topics: [], rating: null },
    });
    renderWithQuery(<SessionDetailPanel gameSessionId={1} />);

    const tile = await findTile('Rating');
    expect(tile).toHaveTextContent(/^RatingFeedback was off$/);
  });

  it('has no fastest answer or fastest team tile', async () => {
    renderWithQuery(<SessionDetailPanel gameSessionId={1} />);

    await findTile('Rating');
    expect(screen.queryByText('Fastest answer')).not.toBeInTheDocument();
    expect(screen.queryByText('Fastest team')).not.toBeInTheDocument();
  });

  it("shows 'Not recorded' for a team with no timed answers", async () => {
    renderWithQuery(<SessionDetailPanel gameSessionId={1} />);

    await waitFor(() => screen.getAllByText('Team B'));
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

  it('lists the comments and the topic suggestions with their counts', async () => {
    renderWithQuery(<SessionDetailPanel gameSessionId={1} />);

    expect(
      await screen.findByRole('heading', { name: 'Comments' }),
    ).toBeInTheDocument();
    const comments = within(
      screen.getByRole('list', { name: 'Comments' }),
    ).getAllByRole('listitem');
    expect(comments.map((c) => c.textContent)).toEqual([
      expect.stringContaining('Too loud at the back'),
      expect.stringContaining('Loved the music round'),
    ]);
    expect(
      screen.getByRole('heading', { name: 'Topic suggestions' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Geography ×4')).toBeInTheDocument();
    expect(screen.getByText('Film ×1')).toBeInTheDocument();
  });

  it('says there are no comments or topics when teams sent none', async () => {
    mockFetchSessionDetail.mockResolvedValue({
      ...DETAIL,
      feedback: { collected: true, comments: [], topics: [], rating: null },
    });
    renderWithQuery(<SessionDetailPanel gameSessionId={1} />);

    expect(await screen.findByText('No comments yet.')).toBeInTheDocument();
    expect(screen.getByText('No topic suggestions yet.')).toBeInTheDocument();
  });

  describe('Night brief', () => {
    const BRIEF = '# Quiz Night\n\nTeams: 2\n';
    const writeText = vi.fn();

    beforeEach(() => {
      mockFetchSessionBrief.mockReset();
      mockFetchSessionBrief.mockResolvedValue(BRIEF);
      mockDownloadTextFile.mockReset();
      writeText.mockReset();
      writeText.mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
    });

    it('copies the fetched brief to the clipboard and says Copied', async () => {
      renderWithQuery(
        <>
          <SessionDetailPanel gameSessionId={1} />
          <Toaster />
        </>,
      );

      await userEvent.click(
        await screen.findByRole('button', { name: 'Copy' }),
      );

      expect(mockFetchSessionBrief).toHaveBeenCalledWith(
        1,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(BRIEF));
      expect(await screen.findByText('Copied')).toBeInTheDocument();
    });

    it('shows an error toast when the brief cannot be copied', async () => {
      writeText.mockRejectedValue(new Error('denied'));
      renderWithQuery(
        <>
          <SessionDetailPanel gameSessionId={1} />
          <Toaster />
        </>,
      );

      await userEvent.click(
        await screen.findByRole('button', { name: 'Copy' }),
      );

      expect(
        await screen.findByText('Could not copy the Night brief'),
      ).toBeInTheDocument();
    });

    it('downloads the fetched brief under the session name and date', async () => {
      mockFetchSessionDetail.mockResolvedValue({
        ...DETAIL,
        name: 'Spring Quiz: Week #3',
        // Midday UTC is the same calendar day in every time zone the tests may run in.
        playedAt: '2026-01-05T12:00:00.000Z',
      });
      renderWithQuery(<SessionDetailPanel gameSessionId={1} />);

      await userEvent.click(
        await screen.findByRole('button', { name: 'Download' }),
      );

      await waitFor(() =>
        expect(mockDownloadTextFile).toHaveBeenCalledWith(
          'night-brief-spring-quiz-week-3-2026-01-05.md',
          BRIEF,
          'text/markdown',
        ),
      );
    });
  });

  it('replaces the feedback sections with a note when feedback was off', async () => {
    mockFetchSessionDetail.mockResolvedValue({
      ...DETAIL,
      feedback: { collected: false, comments: [], topics: [], rating: null },
    });
    renderWithQuery(<SessionDetailPanel gameSessionId={1} />);

    expect(
      await screen.findByText('Feedback was off for this session'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Comments' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Topic suggestions' }),
    ).not.toBeInTheDocument();
  });
});
