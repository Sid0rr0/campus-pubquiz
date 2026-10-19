import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TeamNightDetail, TeamPageHistory } from '@campus-pubquiz/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TEAM_CODE_STORAGE_KEY } from '@/app/lib/team-storage';
import { TeamsApiError } from '@/app/lib/teams-api';
import { TeamPagePanel } from '@/app/team/team-page-panel';
import { renderWithQuery } from '@/test-utils/query';

const { mockFetchTeamPage, mockFetchTeamNight } = vi.hoisted(() => ({
  mockFetchTeamPage: vi.fn(),
  mockFetchTeamNight: vi.fn(),
}));

vi.mock('@/app/lib/teams-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/teams-api')>();
  return {
    ...actual,
    fetchTeamPage: mockFetchTeamPage,
    fetchTeamNight: mockFetchTeamNight,
  };
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

  describe('a night in detail', () => {
    const NIGHT: TeamNightDetail = {
      gameSessionId: 2,
      name: 'Winter Quiz',
      playedAt: '2026-03-01T19:00:00.000Z',
      questions: [
        {
          questionId: 1,
          roundTitle: 'Warm-up',
          roundNumber: 1,
          questionNumber: 1,
          prompt: 'Capital of France?',
          type: 'free_text',
          answerKind: 'text',
          points: 10,
          teamAnswer: 'Paris',
          verdict: 'correct',
          pointsAwarded: 10,
          correctAnswer: 'Paris',
        },
        {
          questionId: 2,
          roundTitle: 'Finale',
          roundNumber: 2,
          questionNumber: 1,
          prompt: 'Smallest first',
          type: 'sort',
          answerKind: 'sort',
          points: 6,
          teamAnswer: 'a → c → b',
          verdict: 'incorrect',
          pointsAwarded: 0,
          correctAnswer: 'a → b → c',
        },
        {
          questionId: 3,
          roundTitle: 'Finale',
          roundNumber: 2,
          questionNumber: 2,
          prompt: 'Pair up',
          type: 'match',
          answerKind: 'match',
          points: 4,
          teamAnswer: null,
          verdict: null,
          pointsAwarded: 0,
          correctAnswer: 'one → x, two → y',
        },
      ],
    };

    beforeEach(() => {
      window.localStorage.setItem(TEAM_CODE_STORAGE_KEY, 'STORED1');
      mockFetchTeamNight.mockReset();
      mockFetchTeamNight.mockResolvedValue(NIGHT);
    });

    it("opens a session to show each question with the team's answer, verdict and the right answer", async () => {
      const user = userEvent.setup();
      renderWithQuery(<TeamPagePanel />);

      await user.click(
        await screen.findByRole('button', { name: 'Winter Quiz' }),
      );

      expect(await screen.findByText('Capital of France?')).toBeInTheDocument();
      expect(mockFetchTeamNight).toHaveBeenCalledWith(
        'STORED1',
        2,
        expect.anything(),
      );
      const first = screen.getByText('Capital of France?').closest('li')!;
      expect(within(first).getByText('Warm-up')).toBeInTheDocument();
      expect(within(first).getByText('Your answer')).toBeInTheDocument();
      expect(within(first).getByText('Correct')).toBeInTheDocument();
      expect(within(first).getByText('10 / 10')).toBeInTheDocument();
      const second = screen.getByText('Smallest first').closest('li')!;
      expect(within(second).getByText('a → c → b')).toBeInTheDocument();
      expect(within(second).getByText('Incorrect')).toBeInTheDocument();
      expect(within(second).getByText('a → b → c')).toBeInTheDocument();
      expect(within(second).getByText('0 / 6')).toBeInTheDocument();
      const third = screen.getByText('Pair up').closest('li')!;
      expect(within(third).getByText('No answer')).toBeInTheDocument();
      expect(within(third).getByText('one → x, two → y')).toBeInTheDocument();
    });

    it('goes back to the history', async () => {
      const user = userEvent.setup();
      renderWithQuery(<TeamPagePanel />);
      await user.click(
        await screen.findByRole('button', { name: 'Winter Quiz' }),
      );
      await screen.findByText('Capital of France?');

      await user.click(
        screen.getByRole('button', { name: /back to history/i }),
      );

      expect(
        await screen.findByRole('button', { name: 'Winter Quiz' }),
      ).toBeInTheDocument();
    });

    it('shows the error when the night cannot be loaded', async () => {
      mockFetchTeamNight.mockRejectedValue(
        new TeamsApiError('No team with that code', 404),
      );
      const user = userEvent.setup();
      renderWithQuery(<TeamPagePanel />);

      await user.click(
        await screen.findByRole('button', { name: 'Winter Quiz' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No team with that code',
      );
    });
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
