import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { LeagueTable, PublicLeague } from '@campus-pubquiz/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeaguePanel } from '@/app/league/league-panel';
import { LeaguesApiError } from '@/app/lib/leagues-api';
import { renderWithQuery } from '@/test-utils/query';

const { mockFetchPublicLeagues, mockFetchLeagueTable } = vi.hoisted(() => ({
  mockFetchPublicLeagues: vi.fn(),
  mockFetchLeagueTable: vi.fn(),
}));

vi.mock('@/app/lib/leagues-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/leagues-api')>();
  return {
    ...actual,
    fetchPublicLeagues: mockFetchPublicLeagues,
    fetchLeagueTable: mockFetchLeagueTable,
  };
});

const AUTUMN: PublicLeague = {
  id: 2,
  name: 'Autumn 2026',
  startsOn: '2026-09-01',
  endsOn: '2999-12-20',
  current: true,
};
const SPRING: PublicLeague = {
  id: 1,
  name: 'Spring 2026',
  startsOn: '2026-02-01',
  endsOn: '2026-05-30',
  current: false,
};

function tableOf(league: PublicLeague, teams: string[]): LeagueTable {
  return {
    ...league,
    rows: teams.map((teamName, index) => ({
      teamId: index + 1,
      teamName,
      leaguePoints: 20 - index,
      nightsPlayed: 4,
      nightsWon: 2 - index,
      averagePlacing: 1.5 + index,
      position: index + 1,
    })),
  };
}

describe('LeaguePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchLeagueTable.mockImplementation((id: number) =>
      Promise.resolve(
        id === AUTUMN.id
          ? tableOf(AUTUMN, ['The Quizzards', 'Brain Trust'])
          : tableOf(SPRING, ['Old Guard']),
      ),
    );
  });

  it('shows the first (current) league table with every column', async () => {
    mockFetchPublicLeagues.mockResolvedValue({ items: [AUTUMN, SPRING] });

    renderWithQuery(<LeaguePanel />);

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(
      within(rows[0])
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['#', 'Team', 'Points', 'Played', 'Won', 'Avg placing']);
    expect(
      within(rows[1])
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['1', 'The Quizzards', '20', '4', '2', '1.5']);
    expect(mockFetchLeagueTable).toHaveBeenCalledWith(2, expect.anything());
  });

  it('switches to another league, past ones after current ones', async () => {
    const user = userEvent.setup();
    mockFetchPublicLeagues.mockResolvedValue({ items: [AUTUMN, SPRING] });
    renderWithQuery(<LeaguePanel />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: /Spring 2026/ }));

    expect(await screen.findByText('Old Guard')).toBeInTheDocument();
  });

  it('shows a dash for a team with no placing', async () => {
    mockFetchPublicLeagues.mockResolvedValue({ items: [AUTUMN] });
    mockFetchLeagueTable.mockResolvedValue({
      ...tableOf(AUTUMN, ['Leavers']),
      rows: [
        {
          teamId: 1,
          teamName: 'Leavers',
          leaguePoints: 1,
          nightsPlayed: 1,
          nightsWon: 0,
          averagePlacing: null,
          position: 1,
        },
      ],
    });

    renderWithQuery(<LeaguePanel />);

    const cells = within(await screen.findByRole('table')).getAllByRole('cell');
    expect(cells.at(-1)).toHaveTextContent('–');
  });

  it('has an empty state for a league nobody has played in', async () => {
    mockFetchPublicLeagues.mockResolvedValue({ items: [AUTUMN] });
    mockFetchLeagueTable.mockResolvedValue(tableOf(AUTUMN, []));

    renderWithQuery(<LeaguePanel />);

    expect(await screen.findByText(/No results yet/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('has an empty state when there are no leagues', async () => {
    mockFetchPublicLeagues.mockResolvedValue({ items: [] });

    renderWithQuery(<LeaguePanel />);

    expect(await screen.findByText(/No leagues yet/)).toBeInTheDocument();
    expect(mockFetchLeagueTable).not.toHaveBeenCalled();
  });

  it('shows an alert when the leagues cannot load', async () => {
    mockFetchPublicLeagues.mockRejectedValue(
      new LeaguesApiError('Could not load leagues', 500),
    );

    renderWithQuery(<LeaguePanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load leagues',
    );
  });
});
