import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LeaderboardEntry } from '@campus-pubquiz/types';
import { TeamsTable } from '@/app/control/teams-table';
import { renderWithQuery } from '@/test-utils/query';

const { mockFetchBonusAwards, mockFetchTeamCode } = vi.hoisted(() => ({
  mockFetchBonusAwards: vi.fn(),
  mockFetchTeamCode: vi.fn(),
}));

vi.mock('@/app/lib/bonus-award-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/lib/bonus-award-api')>();
  return { ...actual, fetchBonusAwards: mockFetchBonusAwards };
});

vi.mock('@/app/lib/teams-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/teams-api')>();
  return { ...actual, fetchTeamCode: mockFetchTeamCode };
});

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title?: string }) => (
    <svg
      role="img"
      aria-label={title}
      data-testid="qr-code"
      data-value={value}
    />
  ),
}));

const JOIN_CODE = 'ABCDEF';
const ROUND_TITLES = ['Animals', 'History'];

const LEADERBOARD: LeaderboardEntry[] = [
  {
    teamId: 1,
    teamName: 'The Quizzards',
    totalPoints: 12,
    rank: 1,
    rankTo: 1,
    bonusPoints: 2,
    positiveBonusPoints: 2,
    negativeBonusPoints: 0,
    roundPoints: [
      { roundTitle: 'Animals', points: 4 },
      { roundTitle: 'History', points: 6 },
    ],
  },
  {
    teamId: 2,
    teamName: 'Second Place',
    totalPoints: 6,
    rank: 2,
    rankTo: 2,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [
      { roundTitle: 'Animals', points: 6 },
      { roundTitle: 'History', points: 0 },
    ],
  },
];

const ENABLED_BONUS_CATEGORIES = ['shot', 'selfie', 'custom'] as const;

async function openBonusModalFor(teamName: string): Promise<void> {
  await userEvent.click(
    screen.getByRole('button', { name: `Actions for ${teamName}` }),
  );
  await userEvent.click(
    await screen.findByRole('menuitem', { name: /award bonus/i }),
  );
}

async function openBonusAwardsListFor(teamName: string): Promise<void> {
  await userEvent.click(
    screen.getByRole('button', { name: `Actions for ${teamName}` }),
  );
  await userEvent.click(
    await screen.findByRole('menuitem', { name: /^bonus awards$/i }),
  );
}

describe('TeamsTable', () => {
  beforeEach(() => {
    mockFetchBonusAwards.mockReset();
    mockFetchBonusAwards.mockResolvedValue({ teamId: 1, awards: [] });
    mockFetchTeamCode.mockReset();
    mockFetchTeamCode.mockResolvedValue({
      teamId: 1,
      teamName: 'The Quizzards',
      code: 'ZEBRA1',
    });
  });

  it('renders a header row with Position, Team, numbered round columns, Bonus, Total, and Actions', () => {
    renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={LEADERBOARD}
        roundTitles={ROUND_TITLES}
        onAwardBonus={vi.fn().mockResolvedValue({ success: true })}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );

    expect(
      screen.getByRole('columnheader', { name: 'Position' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Team' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '2' })).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Animals' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Bonus' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Total' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Actions' }),
    ).toBeInTheDocument();
  });

  it('shows every team with its per-round points, bonus points, and total', () => {
    renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={LEADERBOARD}
        roundTitles={ROUND_TITLES}
        onAwardBonus={vi.fn().mockResolvedValue({ success: true })}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );

    const quizzardsRow = screen.getByText('The Quizzards').closest('tr')!;
    expect(within(quizzardsRow).getByText('4')).toBeInTheDocument(); // round 1
    expect(within(quizzardsRow).getAllByText('6')).toHaveLength(1); // round 2 (total 12 is distinct)
    expect(within(quizzardsRow).getByText('2')).toBeInTheDocument(); // bonus
    expect(within(quizzardsRow).getByText('12')).toBeInTheDocument(); // total

    const secondPlaceRow = screen.getByText('Second Place').closest('tr')!;
    expect(within(secondPlaceRow).getAllByText('6')).toHaveLength(2); // round 1 and total
    expect(within(secondPlaceRow).getAllByText('0')).toHaveLength(2); // round 2 and bonus
  });

  it('shows each round its own points when two rounds share a title', () => {
    renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={[
          {
            ...LEADERBOARD[0],
            roundPoints: [
              { roundTitle: 'Music', points: 3 },
              { roundTitle: 'Music', points: 5 },
            ],
            bonusPoints: 0,
            totalPoints: 8,
          },
        ]}
        roundTitles={['Music', 'Music']}
        onAwardBonus={vi.fn().mockResolvedValue({ success: true })}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );

    const cells = within(
      screen.getByText('The Quizzards').closest('tr')!,
    ).getAllByRole('cell');
    expect(cells.slice(2, 4).map((cell) => cell.textContent)).toEqual([
      '3',
      '5',
    ]);
  });

  it("marks a team's joker round cell, and only that cell", () => {
    renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={[
          {
            ...LEADERBOARD[0],
            roundPoints: [
              { roundTitle: 'Animals', points: 8, isJoker: true },
              { roundTitle: 'History', points: 2, isJoker: false },
            ],
          },
        ]}
        roundTitles={ROUND_TITLES}
        onAwardBonus={vi.fn().mockResolvedValue({ success: true })}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );

    const cells = within(
      screen.getByText('The Quizzards').closest('tr')!,
    ).getAllByRole('cell');
    // Position, Team, round 1, round 2, ...
    expect(within(cells[2]).getByLabelText('Joker round')).toBeInTheDocument();
    expect(cells[2]).toHaveTextContent('8');
    expect(within(cells[3]).queryByLabelText('Joker round')).toBeNull();
  });

  it('shows 0 for every team in a round nobody has scored in', () => {
    renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={LEADERBOARD}
        roundTitles={['Animals', 'History', 'Sport']}
        onAwardBonus={vi.fn().mockResolvedValue({ success: true })}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );

    const thirdRound = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[4].textContent);
    expect(thirdRound).toEqual(['0', '0']);
  });

  it("sorts teams by a round's points when its column header is clicked", async () => {
    const team = (teamId: number, teamName: string, points: number[]) => ({
      ...LEADERBOARD[0],
      teamId,
      teamName,
      roundPoints: points.map((p) => ({ roundTitle: 'Same', points: p })),
    });
    renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={[
          team(1, 'Alpha', [4, 6]),
          team(2, 'Bravo', [6, 0]),
          team(3, 'Charlie', [5, 3]),
        ]}
        roundTitles={['Same', 'Same']}
        onAwardBonus={vi.fn().mockResolvedValue({ success: true })}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );
    const teamNames = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[1].textContent);

    expect(teamNames()).toEqual(['Alpha', 'Bravo', 'Charlie']);

    // Round 1 points: Bravo 6, Charlie 5, Alpha 4.
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    expect(teamNames()).toEqual(['Bravo', 'Charlie', 'Alpha']);

    // Round 2 points: Alpha 6, Charlie 3, Bravo 0.
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    expect(teamNames()).toEqual(['Alpha', 'Charlie', 'Bravo']);
  });

  it("shows each team's position ranked by total points, tied teams sharing a range", () => {
    renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={LEADERBOARD}
        roundTitles={ROUND_TITLES}
        onAwardBonus={vi.fn().mockResolvedValue({ success: true })}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );

    const quizzardsRow = screen.getByText('The Quizzards').closest('tr')!;
    expect(within(quizzardsRow).getByText('1.')).toBeInTheDocument();
    const secondPlaceRow = screen.getByText('Second Place').closest('tr')!;
    expect(within(secondPlaceRow).getByText('2.')).toBeInTheDocument();
  });

  it('renders the leaderboard in the order given, without re-sorting', () => {
    renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={[...LEADERBOARD].reverse()}
        roundTitles={ROUND_TITLES}
        onAwardBonus={vi.fn().mockResolvedValue({ success: true })}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );

    const teamNames = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[1].textContent);
    expect(teamNames).toEqual(['Second Place', 'The Quizzards']);
  });

  it('labels tied teams with their shared range, in the order given', () => {
    const tied = (
      teamId: number,
      teamName: string,
      rank: number,
      rankTo: number,
    ) => ({
      ...LEADERBOARD[1],
      teamId,
      teamName,
      rank,
      rankTo,
    });
    renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={[
          tied(1, 'Alpha', 1, 1),
          tied(2, 'Bravo', 2, 3),
          tied(3, 'Charlie', 2, 3),
          tied(4, 'Delta', 4, 4),
        ]}
        roundTitles={ROUND_TITLES}
        onAwardBonus={vi.fn().mockResolvedValue({ success: true })}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );

    const positions = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => {
        const cells = within(row).getAllByRole('cell');
        return [cells[0].textContent, cells[1].textContent];
      });
    expect(positions).toEqual([
      ['1.', 'Alpha'],
      ['2.–3.', 'Bravo'],
      ['2.–3.', 'Charlie'],
      ['4.', 'Delta'],
    ]);
  });

  it('always renders the table, showing a placeholder row when no teams have joined', () => {
    renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={[]}
        roundTitles={ROUND_TITLES}
        onAwardBonus={vi.fn().mockResolvedValue({ success: true })}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );

    expect(screen.getByRole('columnheader', { name: '1' })).toBeInTheDocument();
    expect(screen.getByText(/no teams have joined yet/i)).toBeInTheDocument();
  });

  it('reflects a freshly graded answer immediately when the leaderboard prop updates', () => {
    const { rerender } = renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={[{ ...LEADERBOARD[0], totalPoints: 0, roundPoints: [] }]}
        roundTitles={ROUND_TITLES}
        onAwardBonus={vi.fn().mockResolvedValue({ success: true })}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );
    const quizzardsRowBefore = screen.getByText('The Quizzards').closest('tr')!;
    expect(within(quizzardsRowBefore).getAllByText('0')).toHaveLength(3); // round 1, round 2, total

    rerender(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={LEADERBOARD}
        roundTitles={ROUND_TITLES}
        onAwardBonus={vi.fn().mockResolvedValue({ success: true })}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );

    const quizzardsRowAfter = screen.getByText('The Quizzards').closest('tr')!;
    expect(within(quizzardsRowAfter).getByText('12')).toBeInTheDocument(); // total
  });

  it('opens a bonus award modal for a team from its actions menu and awards a predefined-category bonus', async () => {
    const onAwardBonus = vi.fn().mockResolvedValue({ success: true });
    renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={LEADERBOARD}
        roundTitles={ROUND_TITLES}
        onAwardBonus={onAwardBonus}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );

    await openBonusModalFor('The Quizzards');

    expect(
      screen.getByRole('dialog', { name: /award bonus.*the quizzards/i }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^selfie$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^award$/i }));

    expect(onAwardBonus).toHaveBeenCalledWith(1, 'selfie', 1, undefined);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('sends one award when Award is clicked twice before the acknowledgement arrives', async () => {
    let release!: (result: { success: true }) => void;
    const onAwardBonus = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={LEADERBOARD}
        roundTitles={ROUND_TITLES}
        onAwardBonus={onAwardBonus}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );

    await openBonusModalFor('The Quizzards');
    const award = screen.getByRole('button', { name: /^award$/i });
    await userEvent.click(award);
    await userEvent.click(award);
    release({ success: true });

    expect(onAwardBonus).toHaveBeenCalledTimes(1);
  });

  it('keeps the bonus modal open with what was typed when the award is rejected', async () => {
    const onAwardBonus = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'Bonus cap reached' });
    renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={LEADERBOARD}
        roundTitles={ROUND_TITLES}
        onAwardBonus={onAwardBonus}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );

    await openBonusModalFor('The Quizzards');
    await userEvent.click(screen.getByRole('button', { name: /^custom$/i }));
    await userEvent.type(screen.getByLabelText('Bonus reason'), 'Best hat');
    await userEvent.click(screen.getByRole('button', { name: /^award$/i }));

    expect(onAwardBonus).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Bonus reason')).toHaveValue('Best hat');
  });

  it('cancels the bonus modal without awarding', async () => {
    const onAwardBonus = vi.fn().mockResolvedValue({ success: true });
    renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={LEADERBOARD}
        roundTitles={ROUND_TITLES}
        onAwardBonus={onAwardBonus}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );

    await openBonusModalFor('Second Place');
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onAwardBonus).not.toHaveBeenCalled();
  });

  it('opens the bonus awards list modal for a team from its actions menu', async () => {
    mockFetchBonusAwards.mockResolvedValue({
      teamId: 1,
      awards: [
        {
          id: 9,
          category: 'shot',
          points: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={LEADERBOARD}
        roundTitles={ROUND_TITLES}
        onAwardBonus={vi.fn().mockResolvedValue({ success: true })}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );

    await openBonusAwardsListFor('The Quizzards');

    expect(
      screen.getByRole('dialog', { name: /bonus awards.*the quizzards/i }),
    ).toBeInTheDocument();
    expect(mockFetchBonusAwards).toHaveBeenCalledWith(JOIN_CODE, 1);
    expect(await screen.findByText(/shot/i)).toBeInTheDocument();
  });

  it('shows a team code fetched on demand from its actions menu', async () => {
    renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={LEADERBOARD}
        roundTitles={ROUND_TITLES}
        onAwardBonus={vi.fn().mockResolvedValue({ success: true })}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Actions for The Quizzards' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: /show team code/i }),
    );

    expect(
      screen.getByRole('dialog', { name: /team code.*the quizzards/i }),
    ).toBeInTheDocument();
    expect(mockFetchTeamCode).toHaveBeenCalledWith(1, expect.anything());
    expect(await screen.findByText('ZEBRA1')).toBeInTheDocument();
    expect(screen.getByTestId('qr-code')).toHaveAttribute(
      'data-value',
      `${window.location.origin}/play?teamCode=ZEBRA1&name=The%20Quizzards&code=${JOIN_CODE}`,
    );
  });
});

describe('TeamsTable coins', () => {
  const renderTable = (coinsByTeamId?: Record<number, number>) =>
    renderWithQuery(
      <TeamsTable
        joinCode={JOIN_CODE}
        leaderboard={LEADERBOARD}
        roundTitles={ROUND_TITLES}
        onAwardBonus={vi.fn().mockResolvedValue({ success: true })}
        enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
        coinsByTeamId={coinsByTeamId}
      />,
    );

  it('shows a Coins column with each team’s coins when given', () => {
    renderTable({ 1: 7, 2: 0 });

    expect(
      screen.getByRole('columnheader', { name: 'Coins' }),
    ).toBeInTheDocument();
    const row = screen.getByText('The Quizzards').closest('tr') as HTMLElement;
    expect(within(row).getByText('7')).toBeInTheDocument();
  });

  it('has no Coins column without balances', () => {
    renderTable();

    expect(
      screen.queryByRole('columnheader', { name: 'Coins' }),
    ).not.toBeInTheDocument();
  });

  describe('the bonus award form’s coins field', () => {
    const renderAwarding = (coinsByTeamId?: Record<number, number>) => {
      const onAwardBonus = vi.fn().mockResolvedValue({ success: true });
      renderWithQuery(
        <TeamsTable
          joinCode={JOIN_CODE}
          leaderboard={LEADERBOARD}
          roundTitles={ROUND_TITLES}
          onAwardBonus={onAwardBonus}
          enabledBonusCategories={[...ENABLED_BONUS_CATEGORIES]}
          coinsByTeamId={coinsByTeamId}
        />,
      );
      return onAwardBonus;
    };

    it('is hidden when power-ups are off', async () => {
      renderAwarding();
      await openBonusModalFor('The Quizzards');

      expect(screen.queryByLabelText('Coin award')).not.toBeInTheDocument();
    });

    it('gives coins alone when the points were left untouched, so taking a coin never gives points', async () => {
      const onAwardBonus = renderAwarding({ 1: 1, 2: 1 });
      await openBonusModalFor('The Quizzards');

      await userEvent.type(screen.getByLabelText('Coin award'), '-1');
      expect(screen.getByLabelText('Bonus points')).toHaveValue(0);
      await userEvent.click(screen.getByRole('button', { name: /^award$/i }));

      expect(onAwardBonus).toHaveBeenCalledWith(1, 'shot', 0, undefined, -1);
    });

    it('brings the default points back when the coins are cleared', async () => {
      renderAwarding({ 1: 1, 2: 1 });
      await openBonusModalFor('The Quizzards');

      await userEvent.type(screen.getByLabelText('Coin award'), '2');
      await userEvent.clear(screen.getByLabelText('Coin award'));

      expect(screen.getByLabelText('Bonus points')).toHaveValue(1);
    });

    it('sends coins beside points the quiz master typed', async () => {
      const onAwardBonus = renderAwarding({ 1: 1, 2: 1 });
      await openBonusModalFor('The Quizzards');

      await userEvent.clear(screen.getByLabelText('Bonus points'));
      await userEvent.type(screen.getByLabelText('Bonus points'), '1');
      await userEvent.type(screen.getByLabelText('Coin award'), '2');
      await userEvent.click(screen.getByRole('button', { name: /^award$/i }));

      expect(onAwardBonus).toHaveBeenCalledWith(1, 'shot', 1, undefined, 2);
    });

    it('can be used alone, with 0 points, and can be negative', async () => {
      const onAwardBonus = renderAwarding({ 1: 1, 2: 1 });
      await openBonusModalFor('The Quizzards');

      await userEvent.clear(screen.getByLabelText('Bonus points'));
      await userEvent.type(screen.getByLabelText('Bonus points'), '0');
      expect(screen.getByRole('button', { name: /^award$/i })).toBeDisabled();

      await userEvent.type(screen.getByLabelText('Coin award'), '-2');
      await userEvent.click(screen.getByRole('button', { name: /^award$/i }));

      expect(onAwardBonus).toHaveBeenCalledWith(1, 'shot', 0, undefined, -2);
    });
  });
});
