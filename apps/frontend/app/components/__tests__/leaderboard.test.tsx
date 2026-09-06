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
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  },
  {
    teamId: 2,
    teamName: 'Second Place',
    totalPoints: 20,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  },
  {
    teamId: 3,
    teamName: 'Third Place',
    totalPoints: 10,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
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

  it('shows one yellow star per point for a small positive bonus total', () => {
    const withBonus: LeaderboardEntry[] = [
      {
        teamId: 1,
        teamName: 'First Place',
        totalPoints: 33,
        bonusPoints: 3,
        positiveBonusPoints: 3,
        negativeBonusPoints: 0,
        roundPoints: [],
      },
    ];
    render(<Leaderboard entries={withBonus} />);

    const badge = screen.getByLabelText('3 bonus points');
    expect(badge).toHaveTextContent('★★★');
    expect(badge).toHaveClass('text-yellow');
  });

  it('shows one magenta star per point for a small negative bonus total (penalty)', () => {
    const withPenalty: LeaderboardEntry[] = [
      {
        teamId: 1,
        teamName: 'First Place',
        totalPoints: 28,
        bonusPoints: -2,
        positiveBonusPoints: 0,
        negativeBonusPoints: -2,
        roundPoints: [],
      },
    ];
    render(<Leaderboard entries={withPenalty} />);

    const badge = screen.getByLabelText('-2 bonus points');
    expect(badge).toHaveTextContent('★★');
    expect(badge).toHaveClass('text-magenta');
  });

  it('shows the number and a single star once the bonus total exceeds 9', () => {
    const withLargeBonus: LeaderboardEntry[] = [
      {
        teamId: 1,
        teamName: 'First Place',
        totalPoints: 40,
        bonusPoints: 12,
        positiveBonusPoints: 12,
        negativeBonusPoints: 0,
        roundPoints: [],
      },
    ];
    render(<Leaderboard entries={withLargeBonus} />);

    expect(screen.getByLabelText('12 bonus points')).toHaveTextContent('12★');
  });

  it('shows both a yellow and a magenta badge for a team with both positive and negative bonus awards', () => {
    const withBoth: LeaderboardEntry[] = [
      {
        teamId: 1,
        teamName: 'First Place',
        totalPoints: 30,
        bonusPoints: 0,
        positiveBonusPoints: 1,
        negativeBonusPoints: -1,
        roundPoints: [],
      },
    ];
    render(<Leaderboard entries={withBoth} />);

    const positiveBadge = screen.getByLabelText('1 bonus points');
    const negativeBadge = screen.getByLabelText('-1 bonus points');
    expect(positiveBadge).toHaveTextContent('★');
    expect(positiveBadge).toHaveClass('text-yellow');
    expect(negativeBadge).toHaveTextContent('★');
    expect(negativeBadge).toHaveClass('text-magenta');
  });

  it('shows no badge for a team with no bonus points', () => {
    render(<Leaderboard entries={ENTRIES} />);

    expect(screen.queryByText('★', { exact: false })).not.toBeInTheDocument();
  });

  it('shows a shared rank range for teams tied on points', () => {
    const TIED: LeaderboardEntry[] = [
      {
        teamId: 1,
        teamName: 'Sole Leader',
        totalPoints: 30,
        bonusPoints: 0,
        positiveBonusPoints: 0,
        negativeBonusPoints: 0,
        roundPoints: [],
      },
      {
        teamId: 2,
        teamName: 'Tied A',
        totalPoints: 20,
        bonusPoints: 0,
        positiveBonusPoints: 0,
        negativeBonusPoints: 0,
        roundPoints: [],
      },
      {
        teamId: 3,
        teamName: 'Tied B',
        totalPoints: 20,
        bonusPoints: 0,
        positiveBonusPoints: 0,
        negativeBonusPoints: 0,
        roundPoints: [],
      },
      {
        teamId: 4,
        teamName: 'Tied C',
        totalPoints: 20,
        bonusPoints: 0,
        positiveBonusPoints: 0,
        negativeBonusPoints: 0,
        roundPoints: [],
      },
      {
        teamId: 5,
        teamName: 'Last Place',
        totalPoints: 5,
        bonusPoints: 0,
        positiveBonusPoints: 0,
        negativeBonusPoints: 0,
        roundPoints: [],
      },
    ];
    render(<Leaderboard entries={TIED} />);

    expect(screen.getByText('Sole Leader').closest('li')).toHaveTextContent(
      '1.',
    );
    for (const name of ['Tied A', 'Tied B', 'Tied C']) {
      expect(screen.getByText(name).closest('li')).toHaveTextContent('2.–4.');
    }
    expect(screen.getByText('Last Place').closest('li')).toHaveTextContent(
      '5.',
    );
  });
});
