import { describe, expect, it } from 'vitest';
import { averagePlacing, displayedAveragePlacing } from '../average-placing';

describe('averagePlacing', () => {
  it('is empty when there are no placings', () => {
    expect(averagePlacing([])).toBeNull();
  });

  it('is the unrounded mean', () => {
    expect(averagePlacing([1, 2, 2])).toBeCloseTo(5 / 3, 10);
  });
});

describe('displayedAveragePlacing', () => {
  it('is empty when there are no placings', () => {
    expect(displayedAveragePlacing([])).toBeNull();
  });

  it('rounds the mean to one decimal', () => {
    expect(displayedAveragePlacing([1, 2, 2])).toBe(1.7);
    expect(displayedAveragePlacing([1, 2])).toBe(1.5);
  });
});
