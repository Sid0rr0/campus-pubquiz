import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DisplayPage from '@/app/display/page';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import { roomView } from '@/test-utils/room-view';

const { mockUseGame, searchParamsRef } = vi.hoisted(() => ({
  mockUseGame: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-display-game', () => ({
  useDisplayGame: mockUseGame,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: () => <svg role="img" data-testid="qr-code" />,
}));

const VERSUS = {
  versusEnabled: true,
  versusSides: [
    { id: 'eng', name: 'Engineering' },
    { id: 'law', name: 'Law' },
  ],
};
const TEAM_SIDES = { 1: 'eng', 2: 'law' };

function show(description: Parameters<typeof roomView>[1]) {
  mockUseGame.mockReturnValue({
    snapshot: roomView(SOCKET_ROOMS.DISPLAY, description),
    connectionError: null,
    sendAction: vi.fn(),
  });
  render(<DisplayPage />);
}

function leaderboard(revealCount: number, hasPrior = true) {
  show({
    settings: VERSUS,
    teamSides: TEAM_SIDES,
    progress: { isLeaderboardVisible: true },
    leaderboard: [
      { teamId: 1, teamName: 'Alpha', totalPoints: 30 },
      { teamId: 2, teamName: 'Beta', totalPoints: 10 },
    ],
    ...(hasPrior && {
      priorStandings: [
        { teamId: 1, teamName: 'Alpha', totalPoints: 10 },
        { teamId: 2, teamName: 'Beta', totalPoints: 30 },
      ],
    }),
    leaderboardRevealCount: revealCount,
  });
}

describe('DisplayPage — Versus', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
  });

  it('shows the lobby each side with its colour and team count', () => {
    show({
      settings: VERSUS,
      teamSides: { 1: 'eng', 2: 'eng', 3: 'law' },
      progress: { status: 'lobby' },
      leaderboard: [
        { teamId: 1, teamName: 'A', totalPoints: 0 },
        { teamId: 2, teamName: 'B', totalPoints: 0 },
        { teamId: 3, teamName: 'C', totalPoints: 0 },
      ],
    });

    const counts = screen.getByTestId('side-counts');
    expect(
      within(counts).getByText(/Engineering: 2 teams/),
    ).toBeInTheDocument();
    expect(within(counts).getByText(/Law: 1 team$/)).toBeInTheDocument();
  });

  describe('ended screen', () => {
    const ended = (totals: [number, number]) =>
      show({
        settings: VERSUS,
        teamSides: TEAM_SIDES,
        progress: { status: 'ended' },
        tookPartTeamIds: [1, 2],
        leaderboard: [
          { teamId: 1, teamName: 'Alpha', totalPoints: totals[0] },
          { teamId: 2, teamName: 'Beta', totalPoints: totals[1] },
        ],
      });

    it('names the winning side next to the bar', () => {
      ended([10, 30]);

      expect(screen.getByText('Law wins')).toBeInTheDocument();
      expect(screen.getByTestId('side-bar')).toBeInTheDocument();
    });

    it('says it is a tie when the lead is shared', () => {
      ended([20, 20]);

      expect(screen.getByText("It's a tie")).toBeInTheDocument();
      expect(screen.queryByText(/wins/)).not.toBeInTheDocument();
    });

    it('shows nothing about sides with Versus off', () => {
      show({
        progress: { status: 'ended' },
        leaderboard: [{ teamId: 1, teamName: 'Alpha', totalPoints: 5 }],
      });

      expect(screen.queryByTestId('side-bar')).not.toBeInTheDocument();
      expect(screen.queryByText(/wins|tie/)).not.toBeInTheDocument();
    });
  });

  it('holds the prior split until the top rank is revealed', () => {
    leaderboard(1);

    expect(screen.getByTestId('side-segment-eng')).toHaveStyle({
      width: '25%',
    });
  });

  it('slides to the current split once the top rank is revealed', () => {
    leaderboard(2);

    expect(screen.getByTestId('side-segment-eng')).toHaveStyle({
      width: '75%',
    });
  });

  it('draws the current split at once with no prior standings', () => {
    leaderboard(0, false);

    expect(screen.getByTestId('side-segment-eng')).toHaveStyle({
      width: '75%',
    });
  });

  it('gives each shown row its side colour dot', () => {
    leaderboard(2);

    expect(screen.getAllByTestId('side-dot')).toHaveLength(2);
  });

  it('draws no bar or dots with Versus off', () => {
    show({
      progress: { isLeaderboardVisible: true },
      leaderboard: [{ teamId: 1, teamName: 'Alpha', totalPoints: 30 }],
      leaderboardRevealCount: 1,
    });

    expect(screen.queryByTestId('side-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('side-dot')).not.toBeInTheDocument();
  });
});
