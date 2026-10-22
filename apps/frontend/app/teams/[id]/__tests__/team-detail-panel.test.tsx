import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TeamDetail, TeamSessionRow } from '@campus-pubquiz/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamsApiError } from '@/app/lib/teams-api';
import { TeamDetailPanel } from '@/app/teams/[id]/team-detail-panel';
import { renderWithQuery } from '@/test-utils/query';

const { mockFetchTeamDetail } = vi.hoisted(() => ({
  mockFetchTeamDetail: vi.fn(),
}));

vi.mock('@/app/lib/teams-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/teams-api')>();
  return { ...actual, fetchTeamDetail: mockFetchTeamDetail };
});

function sessionRow(overrides: Partial<TeamSessionRow>): TeamSessionRow {
  return {
    gameSessionId: 1,
    name: 'Autumn Quiz',
    playedAt: '2026-03-01T19:00:00.000Z',
    placing: 1,
    placingTo: 1,
    teamCount: 12,
    hasLeft: false,
    totalPoints: 30,
    maxPoints: 40,
    correctCount: 20,
    playerCount: 5,
    ...overrides,
  };
}

const DETAIL: TeamDetail = {
  id: 7,
  name: 'The Quizzards',
  summary: {
    sessionsPlayed: 4,
    wins: 1,
    podiums: 2,
    bestPlacing: 1,
    averagePlacing: 2.7,
    averageSharePercent: 71.25,
    averageTotalPoints: 28.5,
    averagePlayerCount: 4.5,
  },
  sessions: [
    sessionRow({
      gameSessionId: 4,
      name: 'Winter Quiz',
      placing: 4,
      placingTo: 4,
    }),
    sessionRow({
      gameSessionId: 3,
      name: 'Tied Quiz',
      placing: 2,
      placingTo: 3,
      playerCount: null,
    }),
    sessionRow({
      gameSessionId: 2,
      name: 'Left Quiz',
      placing: null,
      placingTo: null,
      hasLeft: true,
    }),
    sessionRow({ gameSessionId: 1, name: 'Autumn Quiz' }),
  ],
};

function tile(label: string): HTMLElement {
  return screen.getByText(label).closest('div') as HTMLElement;
}

describe('TeamDetailPanel', () => {
  beforeEach(() => {
    mockFetchTeamDetail.mockReset();
    mockFetchTeamDetail.mockResolvedValue(DETAIL);
  });

  it('shows the summary tiles', async () => {
    renderWithQuery(<TeamDetailPanel teamId={7} />);

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'The Quizzards' }),
      ).toBeInTheDocument(),
    );
    expect(within(tile('Sessions played')).getByText('4')).toBeInTheDocument();
    expect(within(tile('Wins')).getByText('1')).toBeInTheDocument();
    expect(within(tile('Podiums')).getByText('2')).toBeInTheDocument();
    expect(within(tile('Best placing')).getByText('1st')).toBeInTheDocument();
    expect(within(tile('Avg. placing')).getByText('2.7')).toBeInTheDocument();
    expect(
      within(tile('Avg. share of max points')).getByText('71%'),
    ).toBeInTheDocument();
    expect(
      within(tile('Avg. total points')).getByText('28.5'),
    ).toBeInTheDocument();
    expect(within(tile('Avg. players')).getByText('4.5')).toBeInTheDocument();
  });

  it('shows a dash for averages the server could not work out', async () => {
    mockFetchTeamDetail.mockResolvedValue({
      ...DETAIL,
      summary: {
        ...DETAIL.summary,
        bestPlacing: null,
        averagePlacing: null,
        averagePlayerCount: null,
      },
    });
    renderWithQuery(<TeamDetailPanel teamId={7} />);

    await waitFor(() => screen.getByText('Sessions played'));
    expect(within(tile('Best placing')).getByText('—')).toBeInTheDocument();
    expect(within(tile('Avg. placing')).getByText('—')).toBeInTheDocument();
    expect(within(tile('Avg. players')).getByText('—')).toBeInTheDocument();
  });

  it('lists sessions with placing, joint ties, left rows and links to the session stats', async () => {
    renderWithQuery(<TeamDetailPanel teamId={7} />);

    await waitFor(() => screen.getByText('Winter Quiz'));

    const winterRow = screen.getByText('Winter Quiz').closest('tr')!;
    expect(within(winterRow).getByText('4th of 12')).toBeInTheDocument();
    expect(within(winterRow).getByText('75%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Winter Quiz' })).toHaveAttribute(
      'href',
      '/stats/4',
    );
    const tiedRow = screen.getByText('Tied Quiz').closest('tr')!;
    expect(within(tiedRow).getByText('Joint 2nd of 12')).toBeInTheDocument();
    expect(within(tiedRow).getByText('—')).toBeInTheDocument();
    const leftRow = screen.getByText('Left Quiz').closest('tr')!;
    expect(within(leftRow).getByText('left')).toBeInTheDocument();
  });

  it('caps a session’s share at 100% when a joker took the total past the quiz maximum', async () => {
    mockFetchTeamDetail.mockResolvedValue({
      ...DETAIL,
      sessions: [
        sessionRow({ name: 'Joker Night', totalPoints: 46, maxPoints: 40 }),
      ],
    });
    renderWithQuery(<TeamDetailPanel teamId={7} />);

    await waitFor(() => screen.getByText('Joker Night'));
    const row = screen.getByText('Joker Night').closest('tr')!;
    expect(within(row).getByText('100%')).toBeInTheDocument();
  });

  it('sorts the sessions table when a header is clicked', async () => {
    const user = userEvent.setup();
    renderWithQuery(<TeamDetailPanel teamId={7} />);
    await waitFor(() => screen.getByText('Winter Quiz'));

    await user.click(screen.getByRole('button', { name: /^session/i }));

    const names = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/stats/'))
      .map((link) => link.textContent);
    expect(names).toEqual([
      'Autumn Quiz',
      'Left Quiz',
      'Tied Quiz',
      'Winter Quiz',
    ]);
  });

  it('paginates a long session history', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 12 }, (_, index) =>
      sessionRow({ gameSessionId: index + 1, name: `Quiz ${index + 1}` }),
    );
    mockFetchTeamDetail.mockResolvedValue({ ...DETAIL, sessions: many });
    renderWithQuery(<TeamDetailPanel teamId={7} />);
    await waitFor(() => screen.getByText('Quiz 1'));

    expect(screen.queryByText('Quiz 12')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Quiz 12')).toBeInTheDocument();
  });

  it('shows an empty state instead of zeros for a team with no ended sessions', async () => {
    mockFetchTeamDetail.mockResolvedValue({
      ...DETAIL,
      summary: {
        sessionsPlayed: 0,
        wins: 0,
        podiums: 0,
        bestPlacing: null,
        averagePlacing: null,
        averageSharePercent: null,
        averageTotalPoints: null,
        averagePlayerCount: null,
      },
      sessions: [],
    });
    renderWithQuery(<TeamDetailPanel teamId={7} />);

    await waitFor(() =>
      expect(
        screen.getByText(/hasn.t played an ended session yet/i),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText('Sessions played')).not.toBeInTheDocument();
  });

  it('shows a not-found message for an unknown team', async () => {
    mockFetchTeamDetail.mockRejectedValue(
      new TeamsApiError('Team 99 not found', 404),
    );
    renderWithQuery(<TeamDetailPanel teamId={99} />);

    await waitFor(() =>
      expect(screen.getByText('Team not found.')).toBeInTheDocument(),
    );
  });
});
