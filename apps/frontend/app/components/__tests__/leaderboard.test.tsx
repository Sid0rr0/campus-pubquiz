import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('caps the shown teams to maxRank', () => {
    render(<Leaderboard entries={ENTRIES} maxRank={2} />);

    expect(screen.getByText('First Place')).toBeInTheDocument();
    expect(screen.getByText('Second Place')).toBeInTheDocument();
    expect(screen.queryByText('Third Place')).not.toBeInTheDocument();
  });

  it('shows every team when maxRank is omitted', () => {
    render(<Leaderboard entries={ENTRIES} maxRank={undefined} />);

    expect(screen.getByText('First Place')).toBeInTheDocument();
    expect(screen.getByText('Second Place')).toBeInTheDocument();
    expect(screen.getByText('Third Place')).toBeInTheDocument();
  });

  it('shows a tie spanning the cutoff fully, rather than splitting it', () => {
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
        teamName: 'Last Place',
        totalPoints: 5,
        bonusPoints: 0,
        positiveBonusPoints: 0,
        negativeBonusPoints: 0,
        roundPoints: [],
      },
    ];
    // maxRank: 2 would naively cut off mid-tie (Tied A/B share rank 2) —
    // both must show together since they're one tie group.
    render(<Leaderboard entries={TIED} maxRank={2} />);

    expect(screen.getByText('Sole Leader')).toBeInTheDocument();
    expect(screen.getByText('Tied A')).toBeInTheDocument();
    expect(screen.getByText('Tied B')).toBeInTheDocument();
    expect(screen.queryByText('Last Place')).not.toBeInTheDocument();
  });

  it('composes maxRank with revealCount: an entry needs both to show', () => {
    render(<Leaderboard entries={ENTRIES} revealCount={1} maxRank={2} />);

    // revealCount: 1 alone would show only Third Place (last place); maxRank
    // excludes it entirely (rank 3), so nothing renders yet.
    expect(screen.queryByText('Third Place')).not.toBeInTheDocument();
    expect(screen.queryByText('Second Place')).not.toBeInTheDocument();
    expect(screen.queryByText('First Place')).not.toBeInTheDocument();
  });

  describe('rank trend icons', () => {
    it('shows no trend icon when currentRoundIndex is omitted', () => {
      render(<Leaderboard entries={ENTRIES} />);

      expect(screen.queryByLabelText('moved up')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('moved down')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('no change')).not.toBeInTheDocument();
    });

    it('shows an up arrow for a team that overtook another this round', () => {
      // Before this round: Overtaker (10) trailed Leader (20). This round,
      // Overtaker scored 15 and Leader scored 0, flipping the standings.
      const entries: LeaderboardEntry[] = [
        {
          teamId: 1,
          teamName: 'Overtaker',
          totalPoints: 25,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Round 1', points: 15 }],
        },
        {
          teamId: 2,
          teamName: 'Leader',
          totalPoints: 20,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Round 1', points: 0 }],
        },
      ];
      render(<Leaderboard entries={entries} currentRoundIndex={0} />);

      const overtakerRow = screen.getByText('Overtaker').closest('li')!;
      const leaderRow = screen.getByText('Leader').closest('li')!;
      expect(within(overtakerRow).getByLabelText('moved up')).toHaveClass(
        'text-green',
      );
      expect(within(leaderRow).getByLabelText('moved down')).toHaveClass(
        'text-red-500',
      );
    });

    it('shows a dash when a team keeps the same rank after the round', () => {
      const entries: LeaderboardEntry[] = [
        {
          teamId: 1,
          teamName: 'Steady Leader',
          totalPoints: 30,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Round 1', points: 10 }],
        },
        {
          teamId: 2,
          teamName: 'Steady Second',
          totalPoints: 20,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Round 1', points: 5 }],
        },
      ];
      render(<Leaderboard entries={entries} currentRoundIndex={0} />);

      const leaderRow = screen.getByText('Steady Leader').closest('li')!;
      const secondRow = screen.getByText('Steady Second').closest('li')!;
      expect(within(leaderRow).getByLabelText('no change')).toHaveClass(
        'text-dark-blue/40',
      );
      expect(within(secondRow).getByLabelText('no change')).toHaveClass(
        'text-dark-blue/40',
      );
    });

    it('treats a team with no roundPoints entry for the round as scoring 0 that round', () => {
      // Before this round both were tied for 1st (0 points each). Only
      // Scorer's own dense rank stays 0 (still the top team, no longer
      // tied); No Data's rank number gets pushed down to 1, a real drop.
      const entries: LeaderboardEntry[] = [
        {
          teamId: 1,
          teamName: 'Only Scorer',
          totalPoints: 10,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Round 1', points: 10 }],
        },
        {
          teamId: 2,
          teamName: 'No Data',
          totalPoints: 0,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [],
        },
      ];
      render(<Leaderboard entries={entries} currentRoundIndex={0} />);

      const scorerRow = screen.getByText('Only Scorer').closest('li')!;
      const noDataRow = screen.getByText('No Data').closest('li')!;
      expect(within(scorerRow).getByLabelText('no change')).toBeInTheDocument();
      expect(
        within(noDataRow).getByLabelText('moved down'),
      ).toBeInTheDocument();
    });

    it('shows an up arrow for a team that overtakes a fallen tied leader, even though a tie preceded it', () => {
      // Before this round: Alpha and Bravo were tied for 1st (30 each),
      // Climber trailed alone in 3rd (10). This round Climber scored 15 and
      // Bravo scored -10, so Climber ends up in clear 2nd behind Alpha —
      // genuinely ahead of where the tie had placed it.
      const entries: LeaderboardEntry[] = [
        {
          teamId: 1,
          teamName: 'Alpha',
          totalPoints: 30,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Round 1', points: 0 }],
        },
        {
          teamId: 3,
          teamName: 'Climber',
          totalPoints: 25,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Round 1', points: 15 }],
        },
        {
          teamId: 2,
          teamName: 'Bravo',
          totalPoints: 20,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Round 1', points: -10 }],
        },
      ];
      render(<Leaderboard entries={entries} currentRoundIndex={0} />);

      const climberRow = screen.getByText('Climber').closest('li')!;
      const bravoRow = screen.getByText('Bravo').closest('li')!;
      expect(within(climberRow).getByLabelText('moved up')).toHaveClass(
        'text-green',
      );
      expect(within(bravoRow).getByLabelText('moved down')).toHaveClass(
        'text-red-500',
      );
    });
  });

  describe('previousEntries (Kahoot between-questions old-state animation)', () => {
    const OLD_ENTRIES: LeaderboardEntry[] = [
      {
        teamId: 2,
        teamName: 'Runner Up',
        totalPoints: 15,
        bonusPoints: 0,
        positiveBonusPoints: 0,
        negativeBonusPoints: 0,
        roundPoints: [],
      },
      {
        teamId: 1,
        teamName: 'Challenger',
        totalPoints: 10,
        bonusPoints: 0,
        positiveBonusPoints: 0,
        negativeBonusPoints: 0,
        roundPoints: [],
      },
    ];
    // This question's results flip the standings: Challenger scored big and
    // overtakes Runner Up, who scored nothing.
    const NEW_ENTRIES: LeaderboardEntry[] = [
      {
        teamId: 1,
        teamName: 'Challenger',
        totalPoints: 40,
        bonusPoints: 0,
        positiveBonusPoints: 0,
        negativeBonusPoints: 0,
        roundPoints: [],
      },
      {
        teamId: 2,
        teamName: 'Runner Up',
        totalPoints: 15,
        bonusPoints: 0,
        positiveBonusPoints: 0,
        negativeBonusPoints: 0,
        roundPoints: [],
      },
    ];

    afterEach(() => {
      vi.useRealTimers();
    });

    it('opens on the old standings — old order and old totals — not the new ones', () => {
      render(
        <Leaderboard entries={NEW_ENTRIES} previousEntries={OLD_ENTRIES} />,
      );

      const rows = screen.getAllByRole('listitem');
      expect(rows[0]).toHaveTextContent('Runner Up');
      expect(rows[0]).toHaveTextContent('15');
      expect(rows[1]).toHaveTextContent('Challenger');
      expect(rows[1]).toHaveTextContent('10');
    });

    it('settles into the new standings, reordered, once the transition finishes', () => {
      vi.useFakeTimers();
      render(
        <Leaderboard entries={NEW_ENTRIES} previousEntries={OLD_ENTRIES} />,
      );

      act(() => {
        vi.advanceTimersByTime(5_000);
      });

      const rows = screen.getAllByRole('listitem');
      expect(rows[0]).toHaveTextContent('Challenger');
      expect(rows[1]).toHaveTextContent('Runner Up');
    });

    it('renders entries directly with no old-state hold when previousEntries is omitted', () => {
      render(<Leaderboard entries={NEW_ENTRIES} />);

      const rows = screen.getAllByRole('listitem');
      expect(rows[0]).toHaveTextContent('Challenger');
      expect(rows[0]).toHaveTextContent('40');
    });
  });
});
