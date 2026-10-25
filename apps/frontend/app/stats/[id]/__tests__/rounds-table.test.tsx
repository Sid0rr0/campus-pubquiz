import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SessionDetailRoundRow } from '@campus-pubquiz/types';
import { RoundsTable } from '@/app/stats/[id]/rounds-table';

function round(
  overrides: Partial<SessionDetailRoundRow>,
): SessionDetailRoundRow {
  return {
    roundId: 1,
    title: 'Music',
    category: null,
    rating: null,
    correctRate: 0.5,
    pointsPercent: 40,
    avgResponseMs: null,
    ...overrides,
  };
}

describe('RoundsTable average response column', () => {
  it('shows the mean response time in seconds', () => {
    render(
      <RoundsTable
        rounds={[round({ avgResponseMs: 12340 })]}
        hardestRoundId={null}
      />,
    );

    expect(
      screen.getByRole('columnheader', { name: 'Avg. response' }),
    ).toBeInTheDocument();
    expect(screen.getByText('12.3s')).toBeInTheDocument();
  });

  it('says Not recorded when no time was recorded', () => {
    render(
      <RoundsTable
        rounds={[round({ avgResponseMs: null })]}
        hardestRoundId={null}
      />,
    );

    expect(screen.getByText('Not recorded')).toBeInTheDocument();
  });
});

describe('RoundsTable correct rate column', () => {
  it('shows the rate as a percentage', () => {
    render(
      <RoundsTable
        rounds={[round({ correctRate: 0.5 })]}
        hardestRoundId={null}
      />,
    );

    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows a dash for a round with no correct rate', () => {
    render(
      <RoundsTable
        rounds={[round({ title: 'Guesses', correctRate: null })]}
        hardestRoundId={null}
      />,
    );

    const row = screen.getByText('Guesses').closest('tr')!;
    expect(within(row).getAllByText('—')).toHaveLength(3); // category, rating, rate
    expect(within(row).queryByText('0%')).not.toBeInTheDocument();
  });
});

describe('RoundsTable rating column', () => {
  it('shows the average and how many teams rated a rated round', () => {
    render(
      <RoundsTable
        rounds={[round({ rating: { average: 4.2, count: 9 } })]}
        hardestRoundId={null}
      />,
    );

    expect(
      screen.getByRole('columnheader', { name: 'Rating' }),
    ).toBeInTheDocument();
    expect(screen.getByText('★ 4.2 · 9 teams')).toBeInTheDocument();
  });

  it('uses the singular for a single rating', () => {
    render(
      <RoundsTable
        rounds={[round({ rating: { average: 5, count: 1 } })]}
        hardestRoundId={null}
      />,
    );

    expect(screen.getByText('★ 5.0 · 1 team')).toBeInTheDocument();
  });

  it('shows a dash for a round no team rated', () => {
    render(
      <RoundsTable
        rounds={[round({ title: 'Film', category: 'Cinema', rating: null })]}
        hardestRoundId={null}
      />,
    );

    const row = screen.getByText('Film').closest('tr')!;
    expect(within(row).getAllByText('—')).toHaveLength(1);
    expect(within(row).queryByText(/★/)).not.toBeInTheDocument();
  });
});
