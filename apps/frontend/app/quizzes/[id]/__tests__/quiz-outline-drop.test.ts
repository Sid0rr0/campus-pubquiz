import type { DragEndEvent } from '@dnd-kit/core';
import { describe, expect, it } from 'vitest';
import {
  questionsAfterDrop,
  roundsAfterDrop,
} from '@/app/quizzes/[id]/quiz-outline';

const a = { id: 'a' };
const b = { id: 'b' };
const c = { id: 'c' };

function drop(activeId: string, overId: string | null): DragEndEvent {
  return {
    active: { id: activeId },
    over: overId === null ? null : { id: overId },
  } as unknown as DragEndEvent;
}

const open = {
  isReached: false,
  structureEditing: 'open',
  pinnedQuestionCount: 0,
};
const reached = { ...open, isReached: true };

describe('roundsAfterDrop', () => {
  it('moves the dragged round to where it was dropped', () => {
    expect(roundsAfterDrop([a, b, c], undefined, drop('c', 'a'))).toEqual([
      c,
      a,
      b,
    ]);
  });

  it('moves nothing when dropped outside the list or onto itself', () => {
    expect(roundsAfterDrop([a, b], undefined, drop('a', null))).toBeNull();
    expect(roundsAfterDrop([a, b], undefined, drop('a', 'a'))).toBeNull();
  });

  it('refuses a drag to or from a round the live session has reached', () => {
    const described = [reached, open, open] as Parameters<
      typeof roundsAfterDrop
    >[1];
    expect(roundsAfterDrop([a, b, c], described, drop('c', 'a'))).toBeNull();
    expect(roundsAfterDrop([a, b, c], described, drop('c', 'b'))).toEqual([
      a,
      c,
      b,
    ]);
  });
});

describe('questionsAfterDrop', () => {
  it('moves the dragged question to where it was dropped', () => {
    expect(questionsAfterDrop([a, b, c], 0, drop('a', 'c'))).toEqual([b, c, a]);
  });

  it('moves nothing when dropped outside the list', () => {
    expect(questionsAfterDrop([a, b], 0, drop('a', null))).toBeNull();
  });

  it('refuses a drag to or from a pinned question', () => {
    expect(questionsAfterDrop([a, b, c], 1, drop('c', 'a'))).toBeNull();
    expect(questionsAfterDrop([a, b, c], 1, drop('c', 'b'))).toEqual([a, c, b]);
  });
});
