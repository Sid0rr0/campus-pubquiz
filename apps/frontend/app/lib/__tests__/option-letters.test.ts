import { describe, expect, it } from 'vitest';
import {
  getLowerOptionLetter,
  getOptionLetter,
} from '@/app/lib/option-letters';

describe('getOptionLetter', () => {
  it.each([
    [0, 'A'],
    [1, 'B'],
    [25, 'Z'],
    [26, 'AA'],
    [27, 'AB'],
    [51, 'AZ'],
    [52, 'BA'],
    [701, 'ZZ'],
    [702, 'AAA'],
  ])('labels option %i as %s', (index, expected) => {
    expect(getOptionLetter(index)).toBe(expected);
  });
});

describe('getLowerOptionLetter', () => {
  it('is the lowercase label', () => {
    expect(getLowerOptionLetter(0)).toBe('a');
    expect(getLowerOptionLetter(27)).toBe('ab');
  });
});
