import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PowerUpCounts } from '@/app/display/power-up-counts';

describe('PowerUpCounts', () => {
  it('names each power-up used with its count', () => {
    render(
      <PowerUpCounts
        counts={[
          { powerUp: 'fifty_fifty', count: 2 },
          { powerUp: 'first_letter', count: 1 },
        ]}
      />,
    );

    expect(screen.getByTestId('power-up-counts')).toHaveTextContent(
      'Power-ups used: 50/50 ×2 · First letter ×1',
    );
  });

  it('draws nothing when none was used', () => {
    render(<PowerUpCounts counts={[]} />);

    expect(screen.queryByTestId('power-up-counts')).not.toBeInTheDocument();
  });
});
