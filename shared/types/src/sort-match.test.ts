import { describe, expect, it } from 'vitest';
import { isSameMultiset, splitPipeList } from './sort-match';

describe('splitPipeList', () => {
  it('splits, trims, and drops empty segments', () => {
    expect(splitPipeList(' Alice | Bob |  |Carol ')).toEqual([
      'Alice',
      'Bob',
      'Carol',
    ]);
  });

  it('returns an empty array for a blank string', () => {
    expect(splitPipeList('   ')).toEqual([]);
  });
});

describe('isSameMultiset', () => {
  it('is true for the same items in a different order', () => {
    expect(
      isSameMultiset(['Alice', 'Bob', 'Carol'], ['Carol', 'Alice', 'Bob']),
    ).toBe(true);
  });

  it('is false when lengths differ', () => {
    expect(isSameMultiset(['Alice', 'Bob'], ['Alice', 'Bob', 'Carol'])).toBe(
      false,
    );
  });

  it('is false when an item differs', () => {
    expect(isSameMultiset(['Alice', 'Bob'], ['Alice', 'Dave'])).toBe(false);
  });

  it('is false when an item repeats a different number of times', () => {
    expect(
      isSameMultiset(['Alice', 'Alice', 'Bob'], ['Alice', 'Bob', 'Bob']),
    ).toBe(false);
  });
});
