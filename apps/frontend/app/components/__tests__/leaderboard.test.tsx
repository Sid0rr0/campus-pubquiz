import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LeaderboardEntry } from '@campus-pubquiz/types';
import { Leaderboard } from '@/app/components/leaderboard';

const ENTRIES: LeaderboardEntry[] = [
  {
    teamId: 1,
    teamName: 'First Place',
    totalPoints: 30,
    bonusPoints: 0,
    roundPoints: [],
  },
  {
    teamId: 2,
    teamName: 'Second Place',
    totalPoints: 20,
    bonusPoints: 0,
    roundPoints: [],
  },
  {
    teamId: 3,
    teamName: 'Third Place',
    totalPoints: 10,
    bonusPoints: 0,
    roundPoints: [],
  },
];

describe('Leaderboard', () => {
  it('shows every team when revealCount is omitted', () => {
    render(<Leaderboard entries={ENTRIES} />);

    expect(screen.getByText('First Place')).toBeInTheDocument();
    expect(screen.getByText('Second Place')).toBeInTheDocument();
    expect(screen.getByText('Third Place')).toBeInTheDocument();
  });

  it('shows only the last-place team when revealCount is 1', () => {
    render(<Leaderboard entries={ENTRIES} revealCount={1} />);

    expect(screen.getByText('Third Place')).toBeInTheDocument();
    expect(screen.queryByText('Second Place')).not.toBeInTheDocument();
    expect(screen.queryByText('First Place')).not.toBeInTheDocument();
  });

  it('reveals bottom-up, adding the next-lowest-ranked team as revealCount grows', () => {
    render(<Leaderboard entries={ENTRIES} revealCount={2} />);

    expect(screen.getByText('Third Place')).toBeInTheDocument();
    expect(screen.getByText('Second Place')).toBeInTheDocument();
    expect(screen.queryByText('First Place')).not.toBeInTheDocument();
  });

  it('shows nothing when revealCount is 0', () => {
    render(<Leaderboard entries={ENTRIES} revealCount={0} />);

    expect(screen.queryByText('Third Place')).not.toBeInTheDocument();
    expect(screen.queryByText('Second Place')).not.toBeInTheDocument();
    expect(screen.queryByText('First Place')).not.toBeInTheDocument();
  });

  it('clamps revealCount to the number of entries', () => {
    render(<Leaderboard entries={ENTRIES} revealCount={99} />);

    expect(screen.getByText('First Place')).toBeInTheDocument();
    expect(screen.getByText('Second Place')).toBeInTheDocument();
    expect(screen.getByText('Third Place')).toBeInTheDocument();
  });

  it('keeps rank numbering relative to the full standings, not the visible slice', () => {
    render(<Leaderboard entries={ENTRIES} revealCount={1} />);

    // Third Place is rank 3 in the full list even though it's the only row shown.
    const row = screen.getByText('Third Place').closest('li');
    expect(row).toHaveTextContent('3');
  });

  it('shows a "+N" badge for a team with accumulated bonus points', () => {
    const withBonus: LeaderboardEntry[] = [
      {
        teamId: 1,
        teamName: 'First Place',
        totalPoints: 31,
        bonusPoints: 1,
        roundPoints: [],
      },
    ];
    render(<Leaderboard entries={withBonus} />);

    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('shows a "-N" badge for a team with a negative bonus total (penalty)', () => {
    const withPenalty: LeaderboardEntry[] = [
      {
        teamId: 1,
        teamName: 'First Place',
        totalPoints: 28,
        bonusPoints: -2,
        roundPoints: [],
      },
    ];
    render(<Leaderboard entries={withPenalty} />);

    expect(screen.getByText('-2')).toBeInTheDocument();
  });

  it('shows no badge for a team with no bonus points', () => {
    render(<Leaderboard entries={ENTRIES} />);

    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });
});
