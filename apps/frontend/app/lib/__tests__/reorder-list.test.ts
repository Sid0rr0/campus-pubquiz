import { describe, expect, it } from 'vitest';
import { reorderOnDragEnd } from '@/app/lib/reorder-list';

describe('reorderOnDragEnd', () => {
  it("moves the dragged item to the dropped-on item's position", () => {
    const order = ['Mercury', 'Venus', 'Earth'];

    const next = reorderOnDragEnd(order, 'Earth', 'Mercury');

    expect(next).toEqual(['Earth', 'Mercury', 'Venus']);
  });

  it('moves an item forward when dropped later in the list', () => {
    const order = ['Mercury', 'Venus', 'Earth'];

    const next = reorderOnDragEnd(order, 'Mercury', 'Earth');

    expect(next).toEqual(['Venus', 'Earth', 'Mercury']);
  });

  it('returns null when dropped on itself', () => {
    const order = ['Mercury', 'Venus', 'Earth'];

    expect(reorderOnDragEnd(order, 'Venus', 'Venus')).toBeNull();
  });

  it('returns null when the dragged id is not in the list', () => {
    const order = ['Mercury', 'Venus', 'Earth'];

    expect(reorderOnDragEnd(order, 'Mars', 'Venus')).toBeNull();
  });

  it('returns null when the drop target id is not in the list', () => {
    const order = ['Mercury', 'Venus', 'Earth'];

    expect(reorderOnDragEnd(order, 'Venus', 'Mars')).toBeNull();
  });
});
