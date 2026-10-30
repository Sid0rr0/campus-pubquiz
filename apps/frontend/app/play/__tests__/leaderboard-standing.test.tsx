import { screen, within } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import type { SessionDescription } from '@/test-utils/room-view';
import { teamLinkResult } from './test-utils';

const { mockUseTeamLink, mockVibrate, searchParamsRef } = vi.hoisted(() => ({
  mockUseTeamLink: vi.fn(),
  mockVibrate: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-team-link', () => ({
  useTeamLink: mockUseTeamLink,
}));

vi.mock('@/app/lib/vibrate', () => ({ vibrate: mockVibrate }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const BETA_TEAM = {
  teamId: 2,
  teamName: 'Beta',
  teamToken: 'team-token-2',
};

/**
 * A kahoot round's board between questions: Beta (our team) is first on 10
 * points after being second on 5, Alpha slipped to second.
 */
function boardSession(
  revealCount: number,
  leaderboard: SessionDescription['leaderboard'] = [
    { teamId: 2, teamName: 'Beta', totalPoints: 10 },
    { teamId: 1, teamName: 'Alpha', totalPoints: 5 },
  ],
): SessionDescription {
  return {
    rounds: [{ kahootMode: true, questions: [{}] }],
    progress: { status: 'question_open', isLeaderboardVisible: true },
    leaderboard,
    priorStandings: [
      { teamId: 1, teamName: 'Alpha', totalPoints: 10 },
      { teamId: 2, teamName: 'Beta', totalPoints: 5 },
    ],
    leaderboardRevealCount: revealCount,
  };
}

function linkFor(
  session: SessionDescription,
  team: typeof BETA_TEAM,
  connectionError: string | null = null,
) {
  return teamLinkResult({
    session,
    join: { team, connectionError, needsJoinForm: false },
  });
}

describe('PlayPage — own placing on the leaderboard screen', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('campus-pubquiz-team-name', 'Beta');
    searchParamsRef.current = new URLSearchParams();
    mockVibrate.mockReset();
  });

  it('highlights the team own row with its placing once the big screen has revealed that rank', () => {
    mockUseTeamLink.mockReturnValue(linkFor(boardSession(2), BETA_TEAM));
    renderWithQuery(<PlayPage />);

    expect(screen.getByText("You're 1st")).toBeInTheDocument();
    expect(screen.getByTestId('own-leaderboard-row')).toHaveTextContent('Beta');
  });

  it('shows the team coins next to its points when power-ups are on, and none otherwise', () => {
    const team = { ...BETA_TEAM, coins: 3 };
    mockUseTeamLink.mockReturnValue(
      linkFor(
        { ...boardSession(2), settings: { powerUpsEnabled: true } },
        team,
      ),
    );
    const { unmount } = renderWithQuery(<PlayPage />);
    expect(screen.getByTestId('own-leaderboard-row')).toHaveTextContent(
      '10 pts · 3 coins',
    );
    unmount();

    mockUseTeamLink.mockReturnValue(linkFor(boardSession(2), team));
    renderWithQuery(<PlayPage />);
    expect(screen.getByTestId('own-leaderboard-row')).not.toHaveTextContent(
      /coin/,
    );
  });

  it('says "Joint 2nd" for a team tied on points', () => {
    const tiedBoard = [
      { teamId: 3, teamName: 'Gamma', totalPoints: 10 },
      { teamId: 2, teamName: 'Beta', totalPoints: 5, rank: 2, rankTo: 3 },
      { teamId: 1, teamName: 'Alpha', totalPoints: 5, rank: 2, rankTo: 3 },
    ];
    mockUseTeamLink.mockReturnValue(
      linkFor(boardSession(3, tiedBoard), BETA_TEAM),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Joint 2nd')).toBeInTheDocument();
  });

  it('keeps the placing hidden while the big screen has not revealed the team rank yet', () => {
    mockUseTeamLink.mockReturnValue(linkFor(boardSession(1), BETA_TEAM));
    renderWithQuery(<PlayPage />);

    expect(screen.queryByText(/you're/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('own-leaderboard-row')).not.toBeInTheDocument();
  });
});

describe('PlayPage — the 2× stamp on the own leaderboard row', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('campus-pubquiz-team-name', 'Beta');
    searchParamsRef.current = new URLSearchParams();
  });

  it('stamps the own row when the joker round is in the block just scored, even on 0 points', () => {
    const session = {
      ...boardSession(2, [
        { teamId: 2, teamName: 'Beta', totalPoints: 0 },
        { teamId: 1, teamName: 'Alpha', totalPoints: 0 },
      ]),
      jokers: { 2: { roundId: 1, source: 'chosen' as const } },
    };
    mockUseTeamLink.mockReturnValue(linkFor(session, BETA_TEAM));
    renderWithQuery(<PlayPage />);

    expect(
      within(screen.getByTestId('own-leaderboard-row')).getByLabelText(
        'Joker 2×',
      ),
    ).toBeInTheDocument();
  });

  it('shows no stamp for a team whose joker is on another round', () => {
    const session = {
      ...boardSession(2),
      rounds: [{ kahootMode: true, questions: [{}] }, { questions: [{}] }],
      jokers: { 2: { roundId: 2, source: 'chosen' as const } },
    };
    mockUseTeamLink.mockReturnValue(linkFor(session, BETA_TEAM));
    renderWithQuery(<PlayPage />);

    expect(screen.queryByLabelText('Joker 2×')).not.toBeInTheDocument();
  });
});

describe('PlayPage — vibrating when the team moved up', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('campus-pubquiz-team-name', 'Beta');
    searchParamsRef.current = new URLSearchParams();
    mockVibrate.mockReset();
  });

  it('vibrates when the big screen reveals the rank of a team that moved up', () => {
    mockUseTeamLink.mockReturnValue(linkFor(boardSession(1), BETA_TEAM));
    const { rerender } = renderWithQuery(<PlayPage />);

    mockUseTeamLink.mockReturnValue(linkFor(boardSession(2), BETA_TEAM));
    rerender(<PlayPage />);

    expect(mockVibrate).toHaveBeenCalledTimes(1);
    expect(mockVibrate).toHaveBeenCalledWith('rankUp');
  });

  it('stays silent on the first snapshot, even when the rank is already revealed', () => {
    mockUseTeamLink.mockReturnValue(linkFor(boardSession(2), BETA_TEAM));
    renderWithQuery(<PlayPage />);

    expect(mockVibrate).not.toHaveBeenCalled();
  });

  it('stays silent for a team that did not move up', () => {
    const alpha = { teamId: 1, teamName: 'Alpha', teamToken: 'team-token-1' };
    mockUseTeamLink.mockReturnValue(linkFor(boardSession(0), alpha));
    const { rerender } = renderWithQuery(<PlayPage />);

    mockUseTeamLink.mockReturnValue(linkFor(boardSession(2), alpha));
    rerender(<PlayPage />);

    expect(screen.getByText("You're 2nd")).toBeInTheDocument();
    expect(mockVibrate).not.toHaveBeenCalled();
  });

  it('stays silent when the board has no trend for the team', () => {
    const noPriorStandings = (revealCount: number) => ({
      ...boardSession(revealCount),
      priorStandings: [],
    });
    mockUseTeamLink.mockReturnValue(linkFor(noPriorStandings(0), BETA_TEAM));
    const { rerender } = renderWithQuery(<PlayPage />);

    mockUseTeamLink.mockReturnValue(linkFor(noPriorStandings(2), BETA_TEAM));
    rerender(<PlayPage />);

    expect(mockVibrate).not.toHaveBeenCalled();
  });

  it('stays silent when the revealed rank arrives with a reconnect', () => {
    mockUseTeamLink.mockReturnValue(linkFor(boardSession(1), BETA_TEAM));
    const { rerender } = renderWithQuery(<PlayPage />);

    mockUseTeamLink.mockReturnValue(
      linkFor(boardSession(1), BETA_TEAM, 'Reconnecting…'),
    );
    rerender(<PlayPage />);
    mockUseTeamLink.mockReturnValue(linkFor(boardSession(2), BETA_TEAM));
    rerender(<PlayPage />);

    expect(mockVibrate).not.toHaveBeenCalled();
  });
});
