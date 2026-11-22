import { roundIdentity } from '@/quiz/round-identity';

describe('roundIdentity', () => {
  it('picks the round holding most of the questions', () => {
    expect(roundIdentity([1, 2, 3], [[1], [2, 3]])).toBe(1);
  });

  it('goes to the first round on a tie', () => {
    expect(roundIdentity([1, 2], [[1], [2]])).toBe(0);
  });

  it('is gone when none of its questions is left', () => {
    expect(roundIdentity([1, 2], [[3], [4]])).toBeNull();
  });

  it('is gone when the round held no questions', () => {
    expect(roundIdentity([], [[1], []])).toBeNull();
  });

  it('ignores new questions without an id', () => {
    expect(roundIdentity([1], [[undefined, undefined, undefined], [1]])).toBe(
      1,
    );
  });

  it('finds a reordered round at its new position', () => {
    expect(roundIdentity([1, 2], [[5], [1, 2]])).toBe(1);
  });

  it('finds questions moved into a fresh row', () => {
    expect(roundIdentity([1, 2], [[undefined, 1, 2]])).toBe(0);
  });
});
