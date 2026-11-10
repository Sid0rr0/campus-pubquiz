import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AllCluesList } from '@/app/control/all-clues-list';

const CLUES = ['Born in Ulm', 'Patent clerk', 'E = mc²'];

function items() {
  return within(screen.getByRole('list', { name: 'Clues' })).getAllByRole(
    'listitem',
  );
}

describe('AllCluesList', () => {
  it('numbers each clue with what a right answer is worth on it', () => {
    render(<AllCluesList clues={CLUES} />);

    expect(items().map((item) => item.textContent)).toEqual([
      '1. Born in Ulm1.5 pts',
      '2. Patent clerk1 pt',
      '3. E = mc²0.5 pts',
    ]);
  });

  it('marks nothing without the highest clue shown', () => {
    render(<AllCluesList clues={CLUES} />);

    expect(items().map((item) => item.dataset.state)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('marks the clues shown, the highest clue shown, and the ones still hidden', () => {
    render(<AllCluesList clues={CLUES} highestClue={2} />);

    expect(items().map((item) => item.dataset.state)).toEqual([
      'shown',
      'latest',
      'hidden',
    ]);
  });
});
