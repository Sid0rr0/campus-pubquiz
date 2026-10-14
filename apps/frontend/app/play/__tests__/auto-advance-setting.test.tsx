import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { AUTO_ADVANCE_STORAGE_KEY } from '@/app/lib/player-settings-storage';
import { teamLinkResult } from './test-utils';

const { mockUseTeamLink, searchParamsRef } = vi.hoisted(() => ({
  mockUseTeamLink: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-team-link', () => ({
  useTeamLink: mockUseTeamLink,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const TEAM = {
  teamId: 'team-1',
  teamName: 'Returning Team',
  teamToken: 'team-token-1',
};

const ROUNDS = [
  {
    questions: [
      { prompt: 'Name a fruit' },
      { prompt: 'Name a planet' },
      { prompt: 'Name a country' },
    ],
  },
];

describe('PlayPage — auto-advance setting', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseTeamLink.mockReturnValue(teamLinkResult());
  });

  it('keeps showing the current question and offers Prev/Next when auto-advance is off', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem(AUTO_ADVANCE_STORAGE_KEY, '0');
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: { rounds: ROUNDS, progress: { status: 'question_open' } },
        join: { team: TEAM },
      }),
    );
    const { rerender } = renderWithQuery(<PlayPage />);

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();

    // The admin opens a second question — the team's screen must not move.
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: {
          rounds: ROUNDS,
          progress: { status: 'question_open', questionIndex: 1 },
        },
        join: { team: TEAM },
      }),
    );
    rerender(<PlayPage />);

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
    expect(screen.queryByText('Name a planet')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText('Name a planet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prev/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /prev/i }));

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('keeps the navigation when a new view arrives for the same question with auto-advance off', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem(AUTO_ADVANCE_STORAGE_KEY, '0');
    const session = {
      rounds: ROUNDS,
      progress: { status: 'question_open' as const, questionIndex: 1 },
    };
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({ session, join: { team: TEAM } }),
    );
    const { rerender } = renderWithQuery(<PlayPage />);
    await userEvent.click(screen.getByRole('button', { name: /prev/i }));
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();

    mockUseTeamLink.mockReturnValue(
      teamLinkResult({ session, join: { team: TEAM } }),
    );
    rerender(<PlayPage />);

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
  });

  it('shows a browsed-back closest_guess question fully revealed while a later question is on air', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    window.localStorage.setItem(AUTO_ADVANCE_STORAGE_KEY, '0');
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: {
          rounds: [
            {
              questions: [
                {
                  type: 'closest_guess',
                  prompt: 'How tall is the tower?',
                  answer: '55',
                  closestGuess: {
                    hasSubmissions: true,
                    minGuess: '10',
                    maxGuess: '90',
                    closestGuesses: [{ teamName: 'Team B', value: '50' }],
                  },
                },
                { prompt: 'Name a planet' },
              ],
            },
          ],
          progress: { status: 'reveal', revealIndex: 1, questionIndex: 1 },
          closestGuessRevealStep: 0,
        },
        join: { team: TEAM },
      }),
    );
    renderWithQuery(<PlayPage />);

    await userEvent.click(screen.getByRole('button', { name: /prev/i }));

    expect(screen.getByText('How tall is the tower?')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByText('Team B')).toBeInTheDocument();
  });

  it('immediately snaps to the newest question when auto-advance is turned back on', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: {
          rounds: ROUNDS,
          progress: { status: 'question_open', questionIndex: 1 },
        },
        join: { team: TEAM },
      }),
    );
    const { rerender } = renderWithQuery(<PlayPage />);
    expect(screen.getByText('Name a planet')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^settings$/i }));
    await userEvent.click(
      screen.getByRole('checkbox', { name: /auto-advance to new question/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: /close/i }));

    // A third question opens while the team is frozen on the second.
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: {
          rounds: ROUNDS,
          progress: { status: 'question_open', questionIndex: 2 },
        },
        join: { team: TEAM },
      }),
    );
    rerender(<PlayPage />);
    expect(screen.getByText('Name a planet')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^settings$/i }));
    await userEvent.click(
      screen.getByRole('checkbox', { name: /auto-advance to new question/i }),
    );

    expect(screen.getByText('Name a country')).toBeInTheDocument();
  });
});
