import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LeaderboardEntry, TeamView } from '@campus-pubquiz/types';
import { TeamsTable } from '@/app/admin/teams-table';

const ROUND_TITLES = ['Animals', 'History'];

const TEAMS: TeamView[] = [
  { teamId: 1, teamName: 'The Quizzards', isConnected: true },
  { teamId: 2, teamName: 'Second Place', isConnected: true },
];

const LEADERBOARD: LeaderboardEntry[] = [
  {
    teamId: 1,
    teamName: 'The Quizzards',
    totalPoints: 12,
    bonusPoints: 2,
    roundPoints: [
      { roundTitle: 'Animals', points: 4 },
      { roundTitle: 'History', points: 6 },
    ],
  },
  {
    teamId: 2,
    teamName: 'Second Place',
    totalPoints: 6,
    bonusPoints: 0,
    roundPoints: [
      { roundTitle: 'Animals', points: 6 },
      { roundTitle: 'History', points: 0 },
    ],
  },
];

describe('TeamsTable', () => {
  it('renders a header row with Team, numbered round columns, Bonus, and Total', () => {
    render(<TeamsTable teams={TEAMS} leaderboard={LEADERBOARD} roundTitles={ROUND_TITLES} />);

    expect(screen.getByRole('columnheader', { name: 'Team' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '2' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Animals' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Bonus' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument();
  });

  it('shows every team with its per-round points, bonus points, and total', () => {
    render(<TeamsTable teams={TEAMS} leaderboard={LEADERBOARD} roundTitles={ROUND_TITLES} />);

    const quizzardsRow = screen.getByText('The Quizzards').closest('tr')!;
    expect(within(quizzardsRow).getByText('4')).toBeInTheDocument(); // round 1
    expect(within(quizzardsRow).getAllByText('6')).toHaveLength(1); // round 2 (total 12 is distinct)
    expect(within(quizzardsRow).getByText('2')).toBeInTheDocument(); // bonus
    expect(within(quizzardsRow).getByText('12')).toBeInTheDocument(); // total

    const secondPlaceRow = screen.getByText('Second Place').closest('tr')!;
    expect(within(secondPlaceRow).getAllByText('6')).toHaveLength(2); // round 1 and total
    expect(within(secondPlaceRow).getAllByText('0')).toHaveLength(2); // round 2 and bonus
  });

  it('shows a joined team with zeros when the leaderboard has not been computed for it yet', () => {
    render(<TeamsTable teams={TEAMS} leaderboard={[]} roundTitles={ROUND_TITLES} />);

    const quizzardsRow = screen.getByText('The Quizzards').closest('tr')!;
    expect(within(quizzardsRow).getAllByText('0')).toHaveLength(4); // round 1, round 2, bonus, total

    const secondPlaceRow = screen.getByText('Second Place').closest('tr')!;
    expect(within(secondPlaceRow).getAllByText('0')).toHaveLength(4);
  });

  it('always renders the table, showing a placeholder row when no teams have joined', () => {
    render(<TeamsTable teams={[]} leaderboard={[]} roundTitles={ROUND_TITLES} />);

    expect(screen.getByRole('columnheader', { name: '1' })).toBeInTheDocument();
    expect(screen.getByText(/no teams have joined yet/i)).toBeInTheDocument();
  });
});
