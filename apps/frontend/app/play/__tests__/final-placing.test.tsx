import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveShowdownRoundState } from '@campus-pubquiz/types';
import PlayPage from '@/app/play/page';
import type { SessionDescription } from '@/test-utils/room-view';
import { teamLinkResult } from './test-utils';

const { mockUseTeamLink, searchParamsRef, mockFireConfetti } = vi.hoisted(
  () => ({
    mockUseTeamLink: vi.fn(),
    searchParamsRef: { current: new URLSearchParams() },
    mockFireConfetti: vi.fn(),
  }),
);

vi.mock('@/app/lib/use-team-link', () => ({
  useTeamLink: mockUseTeamLink,
}));

vi.mock('@/app/lib/confetti', () => ({
  fireConfetti: mockFireConfetti,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const MY_TEAM_ID = 7;

function leaderboardWith(myRank: number, myRankTo = myRank) {
  const others = Array.from({ length: 5 }, (_, index) => ({
    teamId: index + 1,
    teamName: `Team ${index + 1}`,
    totalPoints: 50 - index * 5,
    rank: index + 1,
    rankTo: index + 1,
  }));
  return others.map((row) =>
    row.rank === myRank
      ? { ...row, teamId: MY_TEAM_ID, rankTo: myRankTo }
      : row,
  );
}

const ENDED: SessionDescription = {
  rounds: [{ title: 'Music', questions: [{}] }],
  progress: { status: 'ended' },
  settings: { collectFeedback: true },
};

const SHOWDOWN: ActiveShowdownRoundState = {
  id: 1,
  question: 'How tall?',
  answer: '330',
  participants: [
    {
      teamId: MY_TEAM_ID,
      teamName: 'The Quizzards',
      seatIndex: 0,
      guess: null,
    },
    { teamId: 1, teamName: 'Team 1', seatIndex: 1, guess: null },
  ],
  winnerTeamId: null,
  isTie: false,
  resolved: false,
};

function show(description: SessionDescription) {
  mockUseTeamLink.mockReturnValue(
    teamLinkResult({
      session: description,
      join: {
        team: {
          teamId: MY_TEAM_ID,
          teamName: 'The Quizzards',
          teamToken: 'token-7',
        },
      },
    }),
  );
}

describe('PlayPage — final placing', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
    searchParamsRef.current = new URLSearchParams();
    mockFireConfetti.mockClear();
  });

  it('shows the plain rank above the final feedback form', () => {
    show({ ...ENDED, leaderboard: leaderboardWith(4) });
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('You finished 4th of 5')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Rate Music 1 of 5' }),
    ).toBeInTheDocument();
  });

  it('shows "Joint" for a tie', () => {
    show({ ...ENDED, leaderboard: leaderboardWith(2, 3) });
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('You finished Joint 2nd of 5')).toBeInTheDocument();
  });

  it('links to the team page on the ended screen when a team code is stored', async () => {
    window.localStorage.setItem('campus-pubquiz-team-code', 'QUICK-JADE-FOX');
    show({ ...ENDED, leaderboard: leaderboardWith(4) });
    renderWithQuery(<PlayPage />);

    expect(
      await screen.findByRole('link', { name: 'Our team page' }),
    ).toHaveAttribute('href', '/team');
  });

  it('shows no team page link on the ended screen without a stored team code', () => {
    show({ ...ENDED, leaderboard: leaderboardWith(4) });
    renderWithQuery(<PlayPage />);

    expect(
      screen.queryByRole('link', { name: 'Our team page' }),
    ).not.toBeInTheDocument();
  });

  it('waits while a showdown is still being played', () => {
    show({
      ...ENDED,
      leaderboard: leaderboardWith(2),
      showdown: { round: SHOWDOWN },
    });
    renderWithQuery(<PlayPage />);

    expect(screen.queryByText(/you finished/i)).not.toBeInTheDocument();
  });

  it('fires no confetti on a phone that loads straight into the ended screen', () => {
    show({ ...ENDED, leaderboard: leaderboardWith(1) });
    renderWithQuery(<PlayPage />);

    expect(mockFireConfetti).not.toHaveBeenCalled();
  });

  it.each([1, 3])(
    'fires confetti when the quiz ends live with the team in place %i',
    (rank) => {
      show({
        rounds: ENDED.rounds,
        progress: { status: 'reveal' },
        leaderboard: leaderboardWith(rank),
      });
      const { rerender } = renderWithQuery(<PlayPage />);

      show({ ...ENDED, leaderboard: leaderboardWith(rank) });
      rerender(<PlayPage />);

      expect(mockFireConfetti).toHaveBeenCalledTimes(1);
    },
  );

  it('fires no confetti outside the top three', () => {
    show({
      rounds: ENDED.rounds,
      progress: { status: 'reveal' },
      leaderboard: leaderboardWith(4),
    });
    const { rerender } = renderWithQuery(<PlayPage />);

    show({ ...ENDED, leaderboard: leaderboardWith(4) });
    rerender(<PlayPage />);

    expect(mockFireConfetti).not.toHaveBeenCalled();
  });
});
