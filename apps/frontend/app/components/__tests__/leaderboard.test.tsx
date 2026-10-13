import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LeaderboardEntry } from '@campus-pubquiz/types';
import { Leaderboard } from '@/app/components/leaderboard';

// Which teams show, in what order, with which label and trend is row
// selection's job (leaderboard-rows.test.ts). These tests cover only what
// the view adds: the phase timers and what a row renders.

function ranked(
  teamId: number,
  teamName: string,
  totalPoints: number,
  rank: number,
  bonus: Partial<LeaderboardEntry> = {},
): LeaderboardEntry {
  return {
    teamId,
    teamName,
    totalPoints,
    rank,
    rankTo: rank,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
    ...bonus,
  };
}

const ENTRIES = [
  ranked(1, 'First Place', 30, 1),
  ranked(2, 'Second Place', 20, 2),
  ranked(3, 'Third Place', 10, 3),
];

describe('Leaderboard', () => {
  it('renders the plain preview: every team, no trend icons, no animation', () => {
    render(<Leaderboard entries={ENTRIES} />);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('1.First Place30');
    expect(rows[1]).toHaveTextContent('2.Second Place20');
    expect(rows[2]).toHaveTextContent('3.Third Place10');
    expect(
      screen.queryByLabelText(/moved up|moved down|no change/),
    ).not.toBeInTheDocument();
  });

  it('renders a revealed row with its label, name, total and trend icon', () => {
    const entries = [
      ranked(1, 'Overtaker', 25, 1, {
        roundPoints: [{ roundTitle: 'Round 1', points: 15 }],
      }),
      ranked(2, 'Leader', 20, 2, {
        roundPoints: [{ roundTitle: 'Round 1', points: 0 }],
      }),
    ];

    render(
      <Leaderboard entries={entries} revealCount={1} currentRoundIndex={0} />,
    );

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('2.Leader20');
    expect(within(rows[0]).getByLabelText('moved down')).toHaveClass(
      'text-red-500',
    );
  });

  describe('bonus stars', () => {
    it('shows one yellow star per point for a small positive bonus total', () => {
      render(
        <Leaderboard
          entries={[
            ranked(1, 'First Place', 33, 1, {
              bonusPoints: 3,
              positiveBonusPoints: 3,
            }),
          ]}
        />,
      );

      const badge = screen.getByLabelText('3 bonus points');
      expect(badge).toHaveTextContent('★★★');
      expect(badge).toHaveClass('text-yellow');
    });

    it('shows one magenta star per point for a small negative bonus total (penalty)', () => {
      render(
        <Leaderboard
          entries={[
            ranked(1, 'First Place', 28, 1, {
              bonusPoints: -2,
              negativeBonusPoints: -2,
            }),
          ]}
        />,
      );

      const badge = screen.getByLabelText('-2 bonus points');
      expect(badge).toHaveTextContent('★★');
      expect(badge).toHaveClass('text-magenta');
    });

    it('shows the number and a single star once the bonus total exceeds 9', () => {
      render(
        <Leaderboard
          entries={[
            ranked(1, 'First Place', 40, 1, {
              bonusPoints: 12,
              positiveBonusPoints: 12,
            }),
          ]}
        />,
      );

      expect(screen.getByLabelText('12 bonus points')).toHaveTextContent('12★');
    });

    it('shows both a yellow and a magenta badge for a team with both positive and negative bonus awards', () => {
      render(
        <Leaderboard
          entries={[
            ranked(1, 'First Place', 30, 1, {
              positiveBonusPoints: 1,
              negativeBonusPoints: -1,
            }),
          ]}
        />,
      );

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
  });

  describe('old-board phase sequence', () => {
    const OLD = [ranked(2, 'Runner Up', 15, 1), ranked(1, 'Challenger', 10, 2)];
    // Challenger scored big and overtakes Runner Up, who scored nothing.
    const NEW = [ranked(1, 'Challenger', 40, 1), ranked(2, 'Runner Up', 15, 2)];
    const HOLD_MS = 900;
    const COUNT_UP_MS = 900;

    afterEach(() => {
      vi.useRealTimers();
    });

    function rowTexts(): string[] {
      return screen
        .getAllByRole('listitem')
        .map((row) => row.textContent ?? '');
    }

    it('opens on the old board, counts up in place, then settles into the new order', () => {
      vi.useFakeTimers();
      render(
        <Leaderboard
          entries={NEW}
          previousEntries={OLD}
          currentRoundIndex={0}
        />,
      );

      expect(rowTexts()).toEqual(['1.Runner Up15', '2.Challenger10']);

      act(() => {
        vi.advanceTimersByTime(HOLD_MS);
      });
      const countingRows = screen.getAllByRole('listitem');
      expect(countingRows[0]).toHaveTextContent('Runner Up');
      expect(countingRows[1]).toHaveTextContent('Challenger');
      expect(
        screen.queryByLabelText(/moved up|moved down|no change/),
      ).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(COUNT_UP_MS);
      });
      const settledRows = screen.getAllByRole('listitem');
      expect(settledRows[0]).toHaveTextContent('1.Challenger');
      expect(settledRows[1]).toHaveTextContent('2.Runner Up');
      expect(within(settledRows[0]).getByLabelText('moved up')).toHaveClass(
        'text-green',
      );
    });
  });
});
