import { describe, expect, it } from 'vitest';
import { isSameMultiset, isSameOrder, splitPipeList } from '../sort-match';

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

describe('isSameOrder', () => {
  it('is true for the same items in the same order', () => {
    expect(isSameOrder(['Alice', 'Bob'], ['Alice', 'Bob'])).toBe(true);
  });

  it('is false for the same items in a different order', () => {
    expect(isSameOrder(['Alice', 'Bob'], ['Bob', 'Alice'])).toBe(false);
  });

  it('is false when lengths differ, even if one is a prefix of the other', () => {
    expect(isSameOrder(['Alice'], ['Alice', 'Bob'])).toBe(false);
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
