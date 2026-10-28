import { describe, expect, it } from 'vitest';
import { isSameItem } from '@/app/control/detail-item';

describe('isSameItem', () => {
  it('matches questions by id and cards by round index', () => {
    expect(
      isSameItem(
        { kind: 'question', questionId: 3 },
        { kind: 'question', questionId: 3 },
      ),
    ).toBe(true);
    expect(
      isSameItem(
        { kind: 'question', questionId: 3 },
        { kind: 'question', questionId: 4 },
      ),
    ).toBe(false);
    expect(
      isSameItem(
        { kind: 'title', roundIndex: 1 },
        { kind: 'title', roundIndex: 1 },
      ),
    ).toBe(true);
    expect(
      isSameItem(
        { kind: 'break', roundIndex: 1 },
        { kind: 'break', roundIndex: 2 },
      ),
    ).toBe(false);
  });

  it('never matches across kinds or against nothing', () => {
    expect(
      isSameItem(
        { kind: 'title', roundIndex: 1 },
        { kind: 'break', roundIndex: 1 },
      ),
    ).toBe(false);
    expect(isSameItem(null, { kind: 'title', roundIndex: 1 })).toBe(false);
    expect(isSameItem({ kind: 'title', roundIndex: 1 }, null)).toBe(false);
  });
});
