import type { ComponentProps } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LeaderboardBoard, LeaderboardEntry } from '@campus-pubquiz/types';
import { Leaderboard as ConnectionAwareLeaderboard } from '@/app/components/leaderboard';

const { mockPlaySound, mockFireConfetti } = vi.hoisted(() => ({
  mockPlaySound: vi.fn(),
  mockFireConfetti: vi.fn(),
}));

vi.mock('@/app/lib/confetti', () => ({ fireConfetti: mockFireConfetti }));

vi.mock('@/app/lib/display-sounds', () => ({
  displaySounds: { play: mockPlaySound },
}));

/** The board as seen by a connected client unless a test says otherwise. */
function Leaderboard(
  props: Omit<ComponentProps<typeof ConnectionAwareLeaderboard>, 'isConnected'>,
) {
  return <ConnectionAwareLeaderboard {...props} isConnected />;
}

// Which teams show, in what order, with which label and trend is row
// selection's job (leaderboard-rows.test.ts). These tests cover only what
// the view adds: the phase timers and what a row renders. Every board is a
// description fixture, as the server sends it.

/** A description with no count-up board and no trends unless given. */
function described(
  entries: LeaderboardEntry[],
  extra: Partial<LeaderboardBoard> = {},
): LeaderboardBoard {
  return { entries, trends: {}, ...extra };
}

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
    render(<Leaderboard board={described(ENTRIES)} />);

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
    const entries = [ranked(1, 'Overtaker', 25, 1), ranked(2, 'Leader', 20, 2)];

    render(
      <Leaderboard
        board={described(entries, { trends: { 1: 'up', 2: 'down' } })}
        revealCount={1}
      />,
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
          board={described([
            ranked(1, 'First Place', 33, 1, {
              bonusPoints: 3,
              positiveBonusPoints: 3,
            }),
          ])}
        />,
      );

      const badge = screen.getByLabelText('3 bonus points');
      expect(badge).toHaveTextContent('★★★');
      expect(badge).toHaveClass('text-yellow');
    });

    it('shows one magenta star per point for a small negative bonus total (penalty)', () => {
      render(
        <Leaderboard
          board={described([
            ranked(1, 'First Place', 28, 1, {
              bonusPoints: -2,
              negativeBonusPoints: -2,
            }),
          ])}
        />,
      );

      const badge = screen.getByLabelText('-2 bonus points');
      expect(badge).toHaveTextContent('★★');
      expect(badge).toHaveClass('text-magenta');
    });

    it('shows the number and a single star once the bonus total exceeds 9', () => {
      render(
        <Leaderboard
          board={described([
            ranked(1, 'First Place', 40, 1, {
              bonusPoints: 12,
              positiveBonusPoints: 12,
            }),
          ])}
        />,
      );

      expect(screen.getByLabelText('12 bonus points')).toHaveTextContent('12★');
    });

    it('shows both a yellow and a magenta badge for a team with both positive and negative bonus awards', () => {
      render(
        <Leaderboard
          board={described([
            ranked(1, 'First Place', 30, 1, {
              positiveBonusPoints: 1,
              negativeBonusPoints: -1,
            }),
          ])}
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
      render(<Leaderboard board={described(ENTRIES)} />);

      expect(screen.queryByText('★', { exact: false })).not.toBeInTheDocument();
    });
  });

  describe('old-board phase sequence', () => {
    const OLD = [ranked(2, 'Runner Up', 15, 1), ranked(1, 'Challenger', 10, 2)];
    // Challenger scored big and overtakes Runner Up, who scored nothing.
    const NEW = [ranked(1, 'Challenger', 40, 1), ranked(2, 'Runner Up', 15, 2)];
    const HOLD_MS = 900;
    const COUNT_UP_MS = 900;

    function rowTexts(): string[] {
      return screen
        .getAllByRole('listitem')
        .map((row) => row.textContent ?? '');
    }

    it('opens on the old board, counts up in place, then settles into the new order', () => {
      vi.useFakeTimers();
      render(
        <Leaderboard
          board={described(NEW, {
            countUpBoard: OLD,
            trends: { 1: 'up', 2: 'down' },
          })}
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

  describe('top-three drama', () => {
    const FIVE = [
      ranked(1, 'One', 50, 1),
      ranked(2, 'Two', 40, 2),
      ranked(3, 'Three', 30, 3),
      ranked(4, 'Four', 20, 4),
      ranked(5, 'Five', 10, 5),
    ];

    beforeEach(() => {
      mockPlaySound.mockReset();
    });

    it('plays the drumroll when an Advance reveals a top-three rank', () => {
      const { rerender } = render(
        <Leaderboard board={described(FIVE)} revealCount={2} />,
      );

      rerender(<Leaderboard board={described(FIVE)} revealCount={3} />);

      expect(mockPlaySound).toHaveBeenCalledTimes(1);
      expect(mockPlaySound).toHaveBeenCalledWith('drumroll');
    });

    it('stays silent while ranks below the top three are revealed', () => {
      const { rerender } = render(
        <Leaderboard board={described(FIVE)} revealCount={0} />,
      );

      rerender(<Leaderboard board={described(FIVE)} revealCount={1} />);
      rerender(<Leaderboard board={described(FIVE)} revealCount={2} />);

      expect(mockPlaySound).not.toHaveBeenCalled();
    });

    it('stays silent when the board loads with the top three already revealed', () => {
      render(<Leaderboard board={described(FIVE)} revealCount={5} />);

      expect(mockPlaySound).not.toHaveBeenCalled();
    });

    it('stays silent for a rank revealed while the client was disconnected', () => {
      const { rerender } = render(
        <ConnectionAwareLeaderboard
          board={described(FIVE)}
          revealCount={2}
          isConnected
        />,
      );

      rerender(
        <ConnectionAwareLeaderboard
          board={described(FIVE)}
          revealCount={3}
          isConnected={false}
        />,
      );
      rerender(
        <ConnectionAwareLeaderboard
          board={described(FIVE)}
          revealCount={3}
          isConnected
        />,
      );

      expect(mockPlaySound).not.toHaveBeenCalled();
    });

    it('puts no highlight behind rank 1', () => {
      render(<Leaderboard board={described(FIVE)} revealCount={5} />);

      expect(
        screen.queryByTestId('rank-one-spotlight'),
      ).not.toBeInTheDocument();
    });

    it('keeps every revealed rank on screen when an Advance arrives mid-entrance', () => {
      const { rerender } = render(
        <Leaderboard board={described(FIVE)} revealCount={3} />,
      );

      rerender(<Leaderboard board={described(FIVE)} revealCount={4} />);

      expect(screen.getAllByRole('listitem')).toHaveLength(4);
    });
  });
  describe('final leaderboard', () => {
    const SIX = [
      ranked(1, 'One', 60, 1),
      ranked(2, 'Two', 50, 2),
      ranked(3, 'Three', 40, 3),
      ranked(4, 'Four', 30, 4),
      ranked(5, 'Five', 20, 5),
      ranked(6, 'Six', 10, 6),
    ];

    beforeEach(() => {
      mockPlaySound.mockReset();
      mockFireConfetti.mockReset();
    });

    function renderFinal(revealCount: number) {
      return render(
        <Leaderboard
          board={described(SIX)}
          revealCount={revealCount}
          isFinal
        />,
      );
    }

    it('stands the revealed top three on a podium instead of in rows', () => {
      renderFinal(5);

      const podium = within(screen.getByTestId('podium'));
      expect(podium.getByText('Three')).toBeInTheDocument();
      expect(podium.getByText('Two')).toBeInTheDocument();
      expect(podium.queryByText('One')).not.toBeInTheDocument();
      const rows = within(screen.getByTestId('leaderboard-rows')).getAllByRole(
        'listitem',
      );
      expect(rows).toHaveLength(3);
      expect(rows[0]).toHaveTextContent('4.Four');
    });

    it('shows no podium until rank 3 is revealed', () => {
      renderFinal(2);

      expect(screen.queryByTestId('podium')).not.toBeInTheDocument();
    });

    it('keeps the plain rows when the board is not the final one', () => {
      render(<Leaderboard board={described(SIX)} revealCount={6} />);

      expect(screen.queryByTestId('podium')).not.toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(6);
    });

    it('plays the fanfare and shoots confetti the moment the winner appears', () => {
      const { rerender } = renderFinal(5);
      expect(mockFireConfetti).not.toHaveBeenCalled();

      rerender(<Leaderboard board={described(SIX)} revealCount={6} isFinal />);

      expect(mockFireConfetti).toHaveBeenCalledTimes(1);
      expect(mockPlaySound).toHaveBeenCalledWith('fanfare');
    });

    it("does not roll the drumroll over the winner's fanfare", () => {
      const { rerender } = renderFinal(5);
      mockPlaySound.mockClear();

      rerender(<Leaderboard board={described(SIX)} revealCount={6} isFinal />);

      expect(mockPlaySound).not.toHaveBeenCalledWith('drumroll');
    });

    it('reports the celebration once it has gone off', () => {
      const onWinnerCelebrated = vi.fn();
      const { rerender } = render(
        <Leaderboard
          board={described(SIX)}
          revealCount={5}
          isFinal
          onWinnerCelebrated={onWinnerCelebrated}
        />,
      );

      rerender(
        <Leaderboard
          board={described(SIX)}
          revealCount={6}
          isFinal
          onWinnerCelebrated={onWinnerCelebrated}
        />,
      );

      expect(onWinnerCelebrated).toHaveBeenCalledTimes(1);
    });

    it('celebrates nothing for a runner-up', () => {
      const { rerender } = renderFinal(4);

      rerender(<Leaderboard board={described(SIX)} revealCount={5} isFinal />);

      expect(mockFireConfetti).not.toHaveBeenCalled();
      expect(mockPlaySound).not.toHaveBeenCalledWith('fanfare');
    });

    it('stays silent when the board loads with the winner already revealed', () => {
      renderFinal(6);

      expect(mockFireConfetti).not.toHaveBeenCalled();
      expect(mockPlaySound).not.toHaveBeenCalled();
    });
  });
});
