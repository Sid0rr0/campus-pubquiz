import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TeamPageHistory } from '@campus-pubquiz/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TEAM_CODE_STORAGE_KEY } from '@/app/lib/team-storage';
import { TeamsApiError } from '@/app/lib/teams-api';
import { TeamPagePanel } from '@/app/team/team-page-panel';
import { renderWithQuery } from '@/test-utils/query';

const { mockFetchTeamPage } = vi.hoisted(() => ({
  mockFetchTeamPage: vi.fn(),
}));

vi.mock('@/app/lib/teams-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/teams-api')>();
  return { ...actual, fetchTeamPage: mockFetchTeamPage };
});

const HISTORY: TeamPageHistory = {
  name: 'The Quizzards',
  summary: {
    sessionsPlayed: 2,
    wins: 1,
    podiums: 1,
    bestPlacing: 1,
    averagePlacing: 2,
    averageSharePercent: 70,
    averageTotalPoints: 28,
    averagePlayerCount: null,
  },
  sessions: [
    {
      gameSessionId: 2,
      name: 'Winter Quiz',
      playedAt: '2026-03-01T19:00:00.000Z',
      placing: 3,
      placingTo: 3,
      teamCount: 12,
      hasLeft: false,
      totalPoints: 20,
      maxPoints: 40,
      correctCount: 10,
      playerCount: null,
    },
    {
      gameSessionId: 1,
      name: 'Autumn Quiz',
      playedAt: '2026-02-01T19:00:00.000Z',
      placing: null,
      placingTo: null,
      teamCount: 8,
      hasLeft: true,
      totalPoints: 4,
      maxPoints: 40,
      correctCount: 2,
      playerCount: null,
    },
  ],
};

describe('TeamPagePanel', () => {
  beforeEach(() => {
    mockFetchTeamPage.mockReset();
    mockFetchTeamPage.mockResolvedValue(HISTORY);
    window.localStorage.clear();
  });

  it('asks for the team code and shows the history once it is entered', async () => {
    const user = userEvent.setup();
    renderWithQuery(<TeamPagePanel />);

    await user.type(
      await screen.findByLabelText('Team code'),
      'quick-jade-fox',
    );
    await user.click(screen.getByRole('button', { name: 'Open team page' }));

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'The Quizzards' }),
      ).toBeInTheDocument(),
    );
    expect(mockFetchTeamPage).toHaveBeenCalledWith(
      'quick-jade-fox',
      expect.anything(),
    );
    const winterRow = screen.getByText('Winter Quiz').closest('tr')!;
    expect(within(winterRow).getByText('3rd of 12')).toBeInTheDocument();
    const autumnRow = screen.getByText('Autumn Quiz').closest('tr')!;
    expect(within(autumnRow).getByText('left')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Winter Quiz' })).toBeNull();
  });

  it('does not save a code the phone did not already store', async () => {
    const user = userEvent.setup();
    renderWithQuery(<TeamPagePanel />);

    await user.type(await screen.findByLabelText('Team code'), 'ABC');
    await user.click(screen.getByRole('button', { name: 'Open team page' }));
    await waitFor(() => screen.getByText('Winter Quiz'));

    expect(window.localStorage.getItem(TEAM_CODE_STORAGE_KEY)).toBeNull();
  });

  it('opens straight away with the team code the phone stored', async () => {
    window.localStorage.setItem(TEAM_CODE_STORAGE_KEY, 'STORED1');
    renderWithQuery(<TeamPagePanel />);

    await waitFor(() => screen.getByText('Winter Quiz'));

    expect(mockFetchTeamPage).toHaveBeenCalledWith(
      'STORED1',
      expect.anything(),
    );
    expect(screen.queryByLabelText('Team code')).toBeNull();
  });

  it('shows the error and the form again for a wrong code', async () => {
    mockFetchTeamPage.mockRejectedValue(
      new TeamsApiError('No team with that code', 404),
    );
    const user = userEvent.setup();
    renderWithQuery(<TeamPagePanel />);

    await user.type(await screen.findByLabelText('Team code'), 'WRONG');
    await user.click(screen.getByRole('button', { name: 'Open team page' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No team with that code',
    );
    expect(screen.getByLabelText('Team code')).toBeInTheDocument();
  });

  it('shows an empty state for a team with no ended session', async () => {
    window.localStorage.setItem(TEAM_CODE_STORAGE_KEY, 'STORED1');
    mockFetchTeamPage.mockResolvedValue({
      ...HISTORY,
      summary: { ...HISTORY.summary, sessionsPlayed: 0 },
      sessions: [],
    });
    renderWithQuery(<TeamPagePanel />);

    await waitFor(() =>
      expect(
        screen.getByText(/hasn.t played an ended session yet/i),
      ).toBeInTheDocument(),
    );
  });
});
