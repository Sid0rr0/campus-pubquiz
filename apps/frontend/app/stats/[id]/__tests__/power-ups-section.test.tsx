import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SessionDetailPowerUps } from '@campus-pubquiz/types';
import { PowerUpsSection } from '@/app/stats/[id]/power-ups-section';

const USED: SessionDetailPowerUps = {
  rows: [
    {
      powerUp: 'fifty_fifty',
      uses: 5,
      teamCount: 3,
      coinsSpent: 10,
      hits: 4,
      pointsGained: null,
    },
    {
      powerUp: 'first_letter',
      uses: 1,
      teamCount: 1,
      coinsSpent: 2,
      hits: 1,
      pointsGained: null,
    },
    {
      powerUp: 'extra_joker',
      uses: 2,
      teamCount: 2,
      coinsSpent: 10,
      hits: null,
      pointsGained: 7,
    },
  ],
  totalUses: 8,
  coinsSpent: 22,
  mostUsed: ['fifty_fifty'],
  mostEffective: ['first_letter'],
};

describe('PowerUpsSection', () => {
  it('draws nothing when the session had no power-ups', () => {
    const { container } = render(<PowerUpsSection powerUps={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the totals, most used and most effective tiles', () => {
    render(<PowerUpsSection powerUps={USED} />);

    expect(screen.getByText('Power-ups used').nextSibling).toHaveTextContent(
      '8',
    );
    expect(
      screen.getByText('Coins spent', { selector: 'p' }).nextSibling,
    ).toHaveTextContent('22');
    expect(screen.getByText('Most used').nextSibling).toHaveTextContent(
      '50/50',
    );
    expect(screen.getByText('Most effective').nextSibling).toHaveTextContent(
      'First letter',
    );
  });

  it('shows each hit rate with its count, and the extra joker its points gained', () => {
    render(<PowerUpsSection powerUps={USED} />);

    const fifty = screen.getByRole('row', { name: /50\/50/ });
    expect(within(fifty).getByText('80% · 4 of 5')).toBeInTheDocument();
    const joker = screen.getByRole('row', { name: /Extra joker/ });
    expect(within(joker).getByText('+7 points')).toBeInTheDocument();
  });

  it('says so when power-ups were on but nobody used one', () => {
    render(
      <PowerUpsSection
        powerUps={{
          rows: [
            { ...USED.rows[0], uses: 0, teamCount: 0, coinsSpent: 0, hits: 0 },
          ],
          totalUses: 0,
          coinsSpent: 0,
          mostUsed: [],
          mostEffective: [],
        }}
      />,
    );

    expect(screen.getByText('No power-ups used')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
