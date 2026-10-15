import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamsDirectoryPanel } from '@/app/teams/teams-directory-panel';
import { renderWithQuery } from '@/test-utils/query';

const { mockFetchTeams } = vi.hoisted(() => ({
  mockFetchTeams: vi.fn(),
}));

vi.mock('@/app/lib/teams-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/teams-api')>();
  return { ...actual, fetchTeams: mockFetchTeams };
});

const PAYLOAD = {
  items: [
    {
      id: 1,
      name: 'The Quizzards',
      code: 'ABC-DEF-GHI',
      joinedAt: '2026-01-05T00:00:00.000Z',
      sessionsJoined: 3,
      averagePlacing: 1.5,
    },
    {
      id: 2,
      name: 'Second Place',
      code: 'JKL-MNO-PQR',
      joinedAt: '2026-01-01T00:00:00.000Z',
      sessionsJoined: 1,
      averagePlacing: null,
    },
  ],
  total: 25,
  page: 1,
  pageSize: 20,
};

describe('TeamsDirectoryPanel', () => {
  beforeEach(() => {
    mockFetchTeams.mockReset();
    mockFetchTeams.mockResolvedValue(PAYLOAD);
  });

  it('lists every team once loaded', async () => {
    renderWithQuery(<TeamsDirectoryPanel />);

    await waitFor(() =>
      expect(screen.getByText('The Quizzards')).toBeInTheDocument(),
    );
    expect(screen.getByText('Second Place')).toBeInTheDocument();
  });

  it('links each team name to its team page', async () => {
    renderWithQuery(<TeamsDirectoryPanel />);
    await waitFor(() => screen.getByText('The Quizzards'));

    expect(screen.getByRole('link', { name: 'The Quizzards' })).toHaveAttribute(
      'href',
      '/teams/1',
    );
    expect(screen.getByRole('link', { name: 'Second Place' })).toHaveAttribute(
      'href',
      '/teams/2',
    );
  });

  it('renders Team/Code headers without a sort toggle', async () => {
    renderWithQuery(<TeamsDirectoryPanel />);
    await waitFor(() => screen.getByText('The Quizzards'));

    const teamHeader = screen.getByRole('columnheader', { name: 'Team' });
    const codeHeader = screen.getByRole('columnheader', { name: 'Code' });
    expect(within(teamHeader).queryByRole('button')).not.toBeInTheDocument();
    expect(within(codeHeader).queryByRole('button')).not.toBeInTheDocument();
  });

  it('toggles sort order on the Joined header and refetches accordingly', async () => {
    const user = userEvent.setup();
    renderWithQuery(<TeamsDirectoryPanel />);
    await waitFor(() => screen.getByText('The Quizzards'));
    mockFetchTeams.mockClear();

    await user.click(screen.getByRole('button', { name: /joined/i }));

    await waitFor(() =>
      expect(mockFetchTeams).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'joinedAt', sortOrder: 'asc' }),
        expect.anything(),
      ),
    );

    mockFetchTeams.mockClear();
    await user.click(screen.getByRole('button', { name: /joined/i }));

    await waitFor(() =>
      expect(mockFetchTeams).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'joinedAt', sortOrder: 'desc' }),
        expect.anything(),
      ),
    );
  });

  it('shows the average placing, or a dash for a team with none', async () => {
    renderWithQuery(<TeamsDirectoryPanel />);
    await waitFor(() => screen.getByText('The Quizzards'));

    const quizzards = screen.getByRole('row', { name: /The Quizzards/ });
    const secondPlace = screen.getByRole('row', { name: /Second Place/ });
    expect(within(quizzards).getByText('1.5')).toBeInTheDocument();
    expect(within(secondPlace).getByText('—')).toBeInTheDocument();
  });

  it('sorts by average placing when its header is clicked', async () => {
    const user = userEvent.setup();
    renderWithQuery(<TeamsDirectoryPanel />);
    await waitFor(() => screen.getByText('The Quizzards'));
    mockFetchTeams.mockClear();

    await user.click(screen.getByRole('button', { name: /avg\. placing/i }));

    await waitFor(() =>
      expect(mockFetchTeams).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'averagePlacing' }),
        expect.anything(),
      ),
    );
  });

  it('disables Prev on the first page and requests page 2 on Next', async () => {
    const user = userEvent.setup();
    renderWithQuery(<TeamsDirectoryPanel />);
    await waitFor(() => screen.getByText('The Quizzards'));

    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled();

    mockFetchTeams.mockClear();
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() =>
      expect(mockFetchTeams).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
        expect.anything(),
      ),
    );
  });

  it('shows a team code from the actions menu without an extra fetch', async () => {
    const user = userEvent.setup();
    renderWithQuery(<TeamsDirectoryPanel />);
    await waitFor(() => screen.getByText('The Quizzards'));

    await user.click(
      screen.getByRole('button', { name: 'Actions for The Quizzards' }),
    );
    await user.click(
      await screen.findByRole('menuitem', { name: /show team code/i }),
    );

    const dialog = screen.getByRole('dialog', {
      name: /team code.*the quizzards/i,
    });
    expect(within(dialog).getByText('ABC-DEF-GHI')).toBeInTheDocument();
  });

  it('shows an error alert when the initial fetch fails', async () => {
    mockFetchTeams.mockReset();
    mockFetchTeams.mockRejectedValue(new Error('Could not load teams'));
    renderWithQuery(<TeamsDirectoryPanel />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not load teams',
      ),
    );
  });
});
