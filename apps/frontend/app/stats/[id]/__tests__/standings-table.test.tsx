import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SessionDetailStandingRow } from '@campus-pubquiz/types';
import { StandingsTable } from '@/app/stats/[id]/standings-table';

function row(
  overrides: Partial<SessionDetailStandingRow> &
    Pick<SessionDetailStandingRow, 'teamId' | 'teamName'>,
): SessionDetailStandingRow {
  return {
    rank: 1,
    rankTo: 1,
    hasLeft: false,
    isWinner: false,
    answerPoints: 0,
    bonusPoints: 0,
    total: 0,
    correctCount: 0,
    avgResponseMs: null,
    ...overrides,
  };
}

function cellsOf(teamName: string): string[] {
  const tableRow = screen.getByText(teamName).closest('tr')!;
  return within(tableRow)
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '');
}

describe('StandingsTable', () => {
  it('labels tied teams with their shared rank range', () => {
    render(
      <StandingsTable
        standings={[
          row({ teamId: 1, teamName: 'Amy', rank: 1, rankTo: 2 }),
          row({ teamId: 2, teamName: 'Zed', rank: 1, rankTo: 2 }),
          row({ teamId: 3, teamName: 'Low', rank: 3, rankTo: 3 }),
        ]}
      />,
    );

    expect(cellsOf('Amy')[0]).toBe('1.–2.');
    expect(cellsOf('Zed')[0]).toBe('1.–2.');
    expect(cellsOf('Low')[0]).toBe('3.');
  });

  it('marks the winner even when its rank is shared', () => {
    render(
      <StandingsTable
        standings={[
          row({
            teamId: 1,
            teamName: 'Amy',
            rank: 1,
            rankTo: 2,
            isWinner: true,
          }),
          row({ teamId: 2, teamName: 'Zed', rank: 1, rankTo: 2 }),
        ]}
      />,
    );

    expect(
      within(screen.getByText('Amy').closest('tr')!).getByText('Winner'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByText('Zed').closest('tr')!).queryByText('Winner'),
    ).not.toBeInTheDocument();
  });

  it('shows "left" instead of a rank for a team that left', () => {
    render(
      <StandingsTable
        standings={[
          row({ teamId: 1, teamName: 'Stayer' }),
          row({
            teamId: 2,
            teamName: 'Kicked',
            rank: null,
            rankTo: null,
            hasLeft: true,
            total: 9,
          }),
        ]}
      />,
    );

    expect(cellsOf('Kicked')[0]).toBe('left');
    expect(cellsOf('Stayer')[0]).toBe('1.');
  });
});
