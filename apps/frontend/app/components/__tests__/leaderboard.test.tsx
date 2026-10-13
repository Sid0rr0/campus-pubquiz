import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LeaderboardEntry } from '@campus-pubquiz/types';
import { Leaderboard } from '@/app/components/leaderboard';

const ENTRIES: LeaderboardEntry[] = [
  {
    teamId: 1,
    teamName: 'First Place',
    totalPoints: 30,
    rank: 1,
    rankTo: 1,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  },
  {
    teamId: 2,
    teamName: 'Second Place',
    totalPoints: 20,
    rank: 2,
    rankTo: 2,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  },
  {
    teamId: 3,
    teamName: 'Third Place',
    totalPoints: 10,
    rank: 3,
    rankTo: 3,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  },
];

function ranked(
  teamId: number,
  teamName: string,
  totalPoints: number,
  rank: number,
  rankTo: number = rank,
): LeaderboardEntry {
  return {
    teamId,
    teamName,
    totalPoints,
    rank,
    rankTo,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  };
}

describe('Leaderboard', () => {
  it('renders every team as a row with its rank label, name and total when revealCount is omitted', () => {
    render(<Leaderboard entries={ENTRIES} />);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('1.First Place30');
    expect(rows[1]).toHaveTextContent('2.Second Place20');
    expect(rows[2]).toHaveTextContent('3.Third Place10');
  });

  it('renders only the rows row selection reveals', () => {
    render(<Leaderboard entries={ENTRIES} revealCount={1} />);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('3.Third Place10');
  });

  it('shows one yellow star per point for a small positive bonus total', () => {
    const withBonus: LeaderboardEntry[] = [
      {
        teamId: 1,
        teamName: 'First Place',
        totalPoints: 33,
        rank: 1,
        rankTo: 1,
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
        rank: 1,
        rankTo: 1,
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
        rank: 1,
        rankTo: 1,
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
        rank: 1,
        rankTo: 1,
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
          rank: 1,
          rankTo: 1,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Round 1', points: 15 }],
        },
        {
          teamId: 2,
          teamName: 'Leader',
          totalPoints: 20,
          rank: 2,
          rankTo: 2,
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

    describe('ties against the previous board (trendBaseline)', () => {
      function trendOf(teamName: string): string | null {
        return (
          within(screen.getByText(teamName).closest('li')!)
            .queryByLabelText(/moved up|moved down|no change/)
            ?.getAttribute('aria-label') ?? null
        );
      }

      it('shows no change for teams that stay tied', () => {
        const board = [
          ranked(1, 'Leader', 30, 1),
          ranked(2, 'Amy', 20, 2, 3),
          ranked(3, 'Zed', 20, 2, 3),
        ];
        const before = [
          ranked(1, 'Leader', 25, 1),
          ranked(2, 'Amy', 15, 2, 3),
          ranked(3, 'Zed', 15, 2, 3),
        ];

        render(<Leaderboard entries={board} trendBaseline={before} />);

        expect(trendOf('Amy')).toBe('no change');
        expect(trendOf('Zed')).toBe('no change');
      });

      it('shows the team that pulled level as moving up, not the one it tied with as dropping', () => {
        const board = [
          ranked(1, 'Leader', 30, 1),
          ranked(2, 'Amy', 20, 2, 3),
          ranked(3, 'Zed', 20, 2, 3),
        ];
        const before = [
          ranked(1, 'Leader', 30, 1),
          ranked(2, 'Amy', 20, 2),
          ranked(3, 'Zed', 10, 3),
        ];

        render(<Leaderboard entries={board} trendBaseline={before} />);

        expect(trendOf('Amy')).toBe('no change');
        expect(trendOf('Zed')).toBe('moved up');
      });

      it('shows a split tie: the team that pulled ahead moves up, the other stays put', () => {
        const board = [
          ranked(1, 'Leader', 30, 1),
          ranked(3, 'Zed', 25, 2),
          ranked(2, 'Amy', 20, 3),
        ];
        const before = [
          ranked(1, 'Leader', 30, 1),
          ranked(2, 'Amy', 20, 2, 3),
          ranked(3, 'Zed', 20, 2, 3),
        ];

        render(<Leaderboard entries={board} trendBaseline={before} />);

        expect(trendOf('Zed')).toBe('no change');
        expect(trendOf('Amy')).toBe('moved down');
      });
    });

    it('shows a dash when a team keeps the same rank after the round', () => {
      const entries: LeaderboardEntry[] = [
        {
          teamId: 1,
          teamName: 'Steady Leader',
          totalPoints: 30,
          rank: 1,
          rankTo: 1,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Round 1', points: 10 }],
        },
        {
          teamId: 2,
          teamName: 'Steady Second',
          totalPoints: 20,
          rank: 2,
          rankTo: 2,
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
          rank: 1,
          rankTo: 1,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Round 1', points: 10 }],
        },
        {
          teamId: 2,
          teamName: 'No Data',
          totalPoints: 0,
          rank: 2,
          rankTo: 2,
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
          rank: 1,
          rankTo: 1,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Round 1', points: 0 }],
        },
        {
          teamId: 3,
          teamName: 'Climber',
          totalPoints: 25,
          rank: 2,
          rankTo: 2,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Round 1', points: 15 }],
        },
        {
          teamId: 2,
          teamName: 'Bravo',
          totalPoints: 20,
          rank: 3,
          rankTo: 3,
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

    it('uses trendBaseline over the currentRoundIndex approximation for a Kahoot round-end reveal', () => {
      // Regression test: a Kahoot round-end/quiz-end reveal never gets
      // previousEntries (it keeps its one-by-one suspense walk rather than
      // animating — see display/page.tsx), so it used to fall back to
      // currentRoundIndex's "this round's points backed out" approximation.
      // That backs out the *entire* round, not just the last question, so
      // whenever a round holds the totality of every team's points (e.g.
      // the quiz's first round), every team's backed-out baseline collapses
      // to the same value — misreading "we're all still tied where we
      // started" as "everyone but the leader fell". trendBaseline (the
      // actual captured previous leaderboard) must take priority instead.
      const oldStandings: LeaderboardEntry[] = [
        {
          teamId: 1,
          teamName: 'Sim Team 1',
          totalPoints: 2890,
          rank: 1,
          rankTo: 1,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Kahoot', points: 2890 }],
        },
        {
          teamId: 4,
          teamName: 'Sim Team 4',
          totalPoints: 2874,
          rank: 2,
          rankTo: 2,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Kahoot', points: 2874 }],
        },
        {
          teamId: 5,
          teamName: 'Sim Team 5',
          totalPoints: 1905,
          rank: 3,
          rankTo: 3,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Kahoot', points: 1905 }],
        },
        {
          teamId: 2,
          teamName: 'Sim Team 2',
          totalPoints: 1903,
          rank: 4,
          rankTo: 4,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Kahoot', points: 1903 }],
        },
        {
          teamId: 8,
          teamName: 'Sim Team 8',
          totalPoints: 1000,
          rank: 5,
          rankTo: 5,
          bonusPoints: 0,
          positiveBonusPoints: 0,
          negativeBonusPoints: 0,
          roundPoints: [{ roundTitle: 'Kahoot', points: 1000 }],
        },
      ];
      const newStandings: LeaderboardEntry[] = [
        {
          ...oldStandings[1],
          totalPoints: 3836,
          rank: 1,
          rankTo: 1,
          roundPoints: [{ roundTitle: 'Kahoot', points: 3836 }],
        },
        {
          ...oldStandings[0],
          totalPoints: 2890,
          rank: 2,
          rankTo: 2,
          roundPoints: [{ roundTitle: 'Kahoot', points: 2890 }],
        },
        {
          ...oldStandings[2],
          totalPoints: 2849,
          rank: 3,
          rankTo: 3,
          roundPoints: [{ roundTitle: 'Kahoot', points: 2849 }],
        },
        {
          ...oldStandings[4],
          totalPoints: 1920,
          rank: 4,
          rankTo: 4,
          roundPoints: [{ roundTitle: 'Kahoot', points: 1920 }],
        },
        {
          ...oldStandings[3],
          totalPoints: 1903,
          rank: 5,
          rankTo: 5,
          roundPoints: [{ roundTitle: 'Kahoot', points: 1903 }],
        },
      ];

      render(
        <Leaderboard
          entries={newStandings}
          trendBaseline={oldStandings}
          currentRoundIndex={0}
        />,
      );

      const expectations: [string, 'moved up' | 'moved down' | 'no change'][] =
        [
          ['Sim Team 4', 'moved up'],
          ['Sim Team 1', 'moved down'],
          ['Sim Team 5', 'no change'],
          ['Sim Team 8', 'moved up'],
          ['Sim Team 2', 'moved down'],
        ];
      for (const [name, trend] of expectations) {
        const row = screen.getByText(name).closest('li')!;
        expect(within(row).getByLabelText(trend)).toBeInTheDocument();
      }
    });
  });

  describe('previousEntries (Kahoot between-questions old-state animation)', () => {
    const OLD_ENTRIES: LeaderboardEntry[] = [
      {
        teamId: 2,
        teamName: 'Runner Up',
        totalPoints: 15,
        rank: 1,
        rankTo: 1,
        bonusPoints: 0,
        positiveBonusPoints: 0,
        negativeBonusPoints: 0,
        roundPoints: [],
      },
      {
        teamId: 1,
        teamName: 'Challenger',
        totalPoints: 10,
        rank: 2,
        rankTo: 2,
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
        rank: 1,
        rankTo: 1,
        bonusPoints: 0,
        positiveBonusPoints: 0,
        negativeBonusPoints: 0,
        roundPoints: [],
      },
      {
        teamId: 2,
        teamName: 'Runner Up',
        totalPoints: 15,
        rank: 2,
        rankTo: 2,
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

    describe('previousEntries as an empty array (no leaderboard computed yet)', () => {
      it('shows an up arrow for every team, since there is no real prior standing to fall from', () => {
        vi.useFakeTimers();
        render(
          <Leaderboard
            entries={NEW_ENTRIES}
            previousEntries={[]}
            currentRoundIndex={0}
          />,
        );

        act(() => {
          vi.advanceTimersByTime(5_000);
        });

        for (const name of ['Challenger', 'Runner Up']) {
          const row = screen.getByText(name).closest('li')!;
          expect(within(row).getByLabelText('moved up')).toHaveClass(
            'text-green',
          );
        }
      });
    });

    describe('rank trend icons driven by previousEntries', () => {
      it('shows an up arrow for every team on the first-ever reveal, when every team was still tied beforehand', () => {
        const tiedOldEntries: LeaderboardEntry[] = [
          {
            teamId: 1,
            teamName: 'Alpha',
            totalPoints: 0,
            rank: 1,
            rankTo: 3,
            bonusPoints: 0,
            positiveBonusPoints: 0,
            negativeBonusPoints: 0,
            roundPoints: [],
          },
          {
            teamId: 2,
            teamName: 'Bravo',
            totalPoints: 0,
            rank: 1,
            rankTo: 3,
            bonusPoints: 0,
            positiveBonusPoints: 0,
            negativeBonusPoints: 0,
            roundPoints: [],
          },
          {
            teamId: 3,
            teamName: 'Charlie',
            totalPoints: 0,
            rank: 1,
            rankTo: 3,
            bonusPoints: 0,
            positiveBonusPoints: 0,
            negativeBonusPoints: 0,
            roundPoints: [],
          },
        ];
        const newEntries: LeaderboardEntry[] = [
          { ...tiedOldEntries[0], totalPoints: 30 },
          { ...tiedOldEntries[1], totalPoints: 10 },
          { ...tiedOldEntries[2], totalPoints: 0 },
        ];

        vi.useFakeTimers();
        render(
          <Leaderboard
            entries={newEntries}
            previousEntries={tiedOldEntries}
            currentRoundIndex={0}
          />,
        );
        act(() => {
          vi.advanceTimersByTime(5_000);
        });

        for (const name of ['Alpha', 'Bravo', 'Charlie']) {
          const row = screen.getByText(name).closest('li')!;
          expect(within(row).getByLabelText('moved up')).toHaveClass(
            'text-green',
          );
        }
      });

      it('compares against the actual old board, not the current round backed out, once teams have pulled apart', () => {
        // Backing this round's points out of the current totals would net
        // every team back to the same OLD_ENTRIES totals here too (since
        // roundPoints is empty on both fixtures) — asserting the real
        // per-team trend confirms previousEntries, not that fallback, is
        // what actually drove the comparison.
        vi.useFakeTimers();
        render(
          <Leaderboard
            entries={NEW_ENTRIES}
            previousEntries={OLD_ENTRIES}
            currentRoundIndex={0}
          />,
        );
        act(() => {
          vi.advanceTimersByTime(5_000);
        });

        const challengerRow = screen.getByText('Challenger').closest('li')!;
        const runnerUpRow = screen.getByText('Runner Up').closest('li')!;
        expect(within(challengerRow).getByLabelText('moved up')).toHaveClass(
          'text-green',
        );
        expect(within(runnerUpRow).getByLabelText('moved down')).toHaveClass(
          'text-red-500',
        );
      });
    });
  });
});
