import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LeagueView } from '@campus-pubquiz/types';
import { LeaguesPanel } from '@/app/leagues/leagues-panel';
import { renderWithQuery } from '@/test-utils/query';

const api = vi.hoisted(() => ({
  fetchLeagues: vi.fn(),
  createLeague: vi.fn(),
  updateLeague: vi.fn(),
  deleteLeague: vi.fn(),
  addLeagueSession: vi.fn(),
  removeLeagueSession: vi.fn(),
  fetchPlayedSessions: vi.fn(),
}));

vi.mock('@/app/lib/leagues-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/lib/leagues-api')>()),
  fetchLeagues: api.fetchLeagues,
  createLeague: api.createLeague,
  updateLeague: api.updateLeague,
  deleteLeague: api.deleteLeague,
  addLeagueSession: api.addLeagueSession,
  removeLeagueSession: api.removeLeagueSession,
}));
vi.mock('@/app/lib/stats-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/lib/stats-api')>()),
  fetchPlayedSessions: api.fetchPlayedSessions,
}));

const LEAGUE: LeagueView = {
  id: 1,
  name: 'Autumn 2026',
  startsOn: '2026-09-01',
  endsOn: '2026-12-20',
  current: true,
  sessions: [
    {
      gameSessionId: 7,
      joinCode: 'AAAA',
      name: 'Quiz Night 1',
      playedAt: '2026-09-10T18:00:00.000Z',
    },
  ],
};

function played(id: number, name: string) {
  return {
    gameSessionId: id,
    joinCode: `C${id}`,
    name,
    quizTitle: name,
    playedAt: '2026-09-10T18:00:00.000Z',
  };
}

describe('LeaguesPanel', () => {
  beforeEach(() => {
    for (const mock of Object.values(api)) mock.mockReset();
    api.fetchLeagues.mockResolvedValue({ items: [LEAGUE] });
    api.fetchPlayedSessions.mockResolvedValue({
      items: [played(7, 'Quiz Night 1'), played(8, 'Quiz Night 2')],
      total: 2,
      page: 1,
      pageSize: 100,
    });
  });

  it('shows empty states for no leagues and for a league with no sessions', async () => {
    api.fetchLeagues.mockResolvedValue({ items: [] });
    const { unmount } = renderWithQuery(<LeaguesPanel />);
    expect(await screen.findByText(/no leagues yet/i)).toBeInTheDocument();
    unmount();

    api.fetchLeagues.mockResolvedValue({
      items: [{ ...LEAGUE, sessions: [] }],
    });
    renderWithQuery(<LeaguesPanel />);
    expect(
      await screen.findByText(/no sessions in this league/i),
    ).toBeInTheDocument();
  });

  it('lists leagues with their dates and sessions', async () => {
    renderWithQuery(<LeaguesPanel />);

    expect(await screen.findByText('Autumn 2026')).toBeInTheDocument();
    expect(screen.getByText(/2026-09-01/)).toBeInTheDocument();
    expect(screen.getByText('Quiz Night 1')).toBeInTheDocument();
  });

  it('creates a league from the form', async () => {
    const user = userEvent.setup();
    api.createLeague.mockResolvedValue({ ...LEAGUE, id: 2 });
    renderWithQuery(<LeaguesPanel />);
    await screen.findByText('Autumn 2026');

    const form = screen.getByRole('form', { name: /new league/i });
    await user.type(within(form).getByLabelText(/name/i), 'Spring 2027');
    await user.type(within(form).getByLabelText(/starts/i), '2027-02-01');
    await user.type(within(form).getByLabelText(/ends/i), '2027-06-01');
    await user.click(within(form).getByRole('button', { name: /create/i }));

    await waitFor(() =>
      expect(api.createLeague).toHaveBeenCalledWith({
        name: 'Spring 2027',
        startsOn: '2027-02-01',
        endsOn: '2027-06-01',
      }),
    );
  });

  it('edits a league name and dates', async () => {
    const user = userEvent.setup();
    api.updateLeague.mockResolvedValue(LEAGUE);
    renderWithQuery(<LeaguesPanel />);
    await screen.findByText('Autumn 2026');

    await user.click(screen.getByRole('button', { name: /edit autumn 2026/i }));
    const form = screen.getByRole('form', { name: /edit autumn 2026/i });
    const name = within(form).getByLabelText(/name/i);
    await user.clear(name);
    await user.type(name, 'Autumn');
    await user.click(within(form).getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(api.updateLeague).toHaveBeenCalledWith(1, {
        name: 'Autumn',
        startsOn: '2026-09-01',
        endsOn: '2026-12-20',
      }),
    );
  });

  it('deletes a league after confirming', async () => {
    const user = userEvent.setup();
    api.deleteLeague.mockResolvedValue(undefined);
    renderWithQuery(<LeaguesPanel />);
    await screen.findByText('Autumn 2026');

    await user.click(
      screen.getByRole('button', { name: /delete autumn 2026/i }),
    );
    expect(api.deleteLeague).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /^delete league$/i }));

    await waitFor(() => expect(api.deleteLeague).toHaveBeenCalledWith(1));
  });

  it('removes a session from the league', async () => {
    const user = userEvent.setup();
    api.removeLeagueSession.mockResolvedValue(undefined);
    renderWithQuery(<LeaguesPanel />);
    await screen.findByText('Quiz Night 1');

    await user.click(
      screen.getByRole('button', { name: /remove quiz night 1/i }),
    );

    await waitFor(() =>
      expect(api.removeLeagueSession).toHaveBeenCalledWith(1, 7),
    );
  });

  it('offers only ended sessions not already in the league, and adds the chosen one', async () => {
    const user = userEvent.setup();
    api.addLeagueSession.mockResolvedValue(undefined);
    renderWithQuery(<LeaguesPanel />);
    await screen.findByText('Quiz Night 1');

    const picker = await screen.findByLabelText(
      /add a session to autumn 2026/i,
    );
    const options = within(picker)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual([
      'Choose a session…',
      expect.stringContaining('Quiz Night 2'),
    ]);

    await user.selectOptions(picker, '8');
    await user.click(screen.getByRole('button', { name: /^add session$/i }));

    await waitFor(() =>
      expect(api.addLeagueSession).toHaveBeenCalledWith(1, 8),
    );
  });

  it('says so when every ended session is already in the league', async () => {
    api.fetchPlayedSessions.mockResolvedValue({
      items: [played(7, 'Quiz Night 1')],
      total: 1,
      page: 1,
      pageSize: 100,
    });
    renderWithQuery(<LeaguesPanel />);

    expect(
      await screen.findByText(/no ended sessions left to add/i),
    ).toBeInTheDocument();
  });

  it('shows an alert when leagues fail to load', async () => {
    api.fetchLeagues.mockRejectedValue(new Error('Could not load leagues'));
    renderWithQuery(<LeaguesPanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load leagues',
    );
  });
});
