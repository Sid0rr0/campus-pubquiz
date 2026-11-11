import { screen, within } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
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

const SIDES = [
  { id: 'eng', name: 'Engineering' },
  { id: 'law', name: 'Law' },
  { id: 'art', name: 'Arts' },
];

function renderLeaderboard(mySideId: string, leaderboardRevealCount = 3) {
  window.localStorage.setItem('campus-pubquiz-team-name', 'Beta');
  mockUseTeamLink.mockReturnValue(
    teamLinkResult({
      session: {
        rounds: [{ quickfire: true, questions: [{}] }],
        progress: { status: 'question_open', isLeaderboardVisible: true },
        leaderboard: [
          { teamId: 1, teamName: 'Alpha', totalPoints: 30 },
          { teamId: 2, teamName: 'Beta', totalPoints: 10 },
          { teamId: 3, teamName: 'Gamma', totalPoints: 20 },
        ],
        settings: { versusEnabled: true, versusSides: SIDES },
        teamSides: { 1: 'law', 2: 'eng', 3: 'eng' },
        leaderboardRevealCount,
      },
      join: {
        team: { teamId: 2, teamName: 'Beta', teamToken: 'token-2' },
        connectionError: null,
        needsJoinForm: false,
      },
      game: { mySideId },
    }),
  );
  renderWithQuery(<PlayPage />);
}

describe('PlayPage — the side bar on the leaderboard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
  });

  it('shows each side share, average and percentage, with the own side highlighted and "No teams" on an empty one', () => {
    renderLeaderboard('eng');

    const bar = screen.getByTestId('side-bar');
    expect(within(bar).getByText('15 pts avg · 33%')).toBeInTheDocument();
    expect(within(bar).getByText('30 pts avg · 67%')).toBeInTheDocument();
    expect(within(bar).getByText('No teams')).toBeInTheDocument();
    expect(within(bar).getByText('0%')).toBeInTheDocument();
    // Segments are full-width layers scaled to their cumulative share (transform only animates).
    expect(screen.getByTestId('side-segment-eng').style.transform).toMatch(
      /^scaleX\(0\.3333/,
    );
    const own = within(bar)
      .getByText(/Engineering/)
      .closest('li');
    expect(own).toHaveAttribute('data-own', 'true');
    expect(within(bar).getByText('Law').closest('li')).toHaveAttribute(
      'data-own',
      'false',
    );
  });

  it('shows no bar until every rank is revealed', () => {
    renderLeaderboard('eng', 2);

    expect(screen.queryByTestId('side-bar')).not.toBeInTheDocument();
  });
});
