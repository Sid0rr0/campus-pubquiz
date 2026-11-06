import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useReorderableDraft } from '@/app/play/use-reorderable-draft';

const items = ['a', 'b', 'c'];

function dragEnd(active: string, over: string | null): DragEndEvent {
  return {
    active: { id: active },
    over: over === null ? null : { id: over },
  } as DragEndEvent;
}

describe('useReorderableDraft', () => {
  it('needs a 4px drag to start, so a tap still scrolls, and moves by keyboard along the list', () => {
    const { result } = renderHook(() =>
      useReorderableDraft([], items, undefined),
    );

    const [pointer, keyboard] = result.current.dragProps.sensors!;
    expect(pointer.sensor).toBe(PointerSensor);
    expect(pointer.options).toEqual({ activationConstraint: { distance: 4 } });
    expect(keyboard.sensor).toBe(KeyboardSensor);
    expect(keyboard.options).toEqual({
      coordinateGetter: sortableKeyboardCoordinates,
    });
  });

  it('starts from the restored order when it fits the items', () => {
    const { result } = renderHook(() =>
      useReorderableDraft(['c', 'a', 'b'], items, undefined),
    );
    expect(result.current.order).toEqual(['c', 'a', 'b']);
  });

  it('starts from the items when nothing was restored or the length differs', () => {
    expect(
      renderHook(() => useReorderableDraft([], items, undefined)).result.current
        .order,
    ).toEqual(items);
    expect(
      renderHook(() => useReorderableDraft(['c', 'a'], items, undefined)).result
        .current.order,
    ).toEqual(items);
  });

  it('applies a bought pin on every read', () => {
    const { result } = renderHook(() =>
      useReorderableDraft([], items, {
        kind: 'pin_one',
        item: 'c',
        position: 0,
      }),
    );
    expect(result.current.order).toEqual(['c', 'a', 'b']);
  });

  it('tracks dragging from start to end and to cancel', () => {
    const { result } = renderHook(() =>
      useReorderableDraft([], items, undefined),
    );
    expect(result.current.isDragging).toBe(false);
    act(() => result.current.dragProps.onDragStart());
    expect(result.current.isDragging).toBe(true);
    act(() => result.current.dragProps.onDragEnd(dragEnd('a', 'b')));
    expect(result.current.isDragging).toBe(false);
    act(() => result.current.dragProps.onDragStart());
    act(() => result.current.dragProps.onDragCancel());
    expect(result.current.isDragging).toBe(false);
  });

  it('reorders on drag end', () => {
    const { result } = renderHook(() =>
      useReorderableDraft([], items, undefined),
    );
    act(() => result.current.dragProps.onDragEnd(dragEnd('a', 'c')));
    expect(result.current.order).toEqual(['b', 'c', 'a']);
  });

  it('keeps the order when dropped nowhere or on itself', () => {
    const { result } = renderHook(() =>
      useReorderableDraft([], items, undefined),
    );
    act(() => result.current.dragProps.onDragEnd(dragEnd('a', null)));
    act(() => result.current.dragProps.onDragEnd(dragEnd('a', 'a')));
    expect(result.current.order).toEqual(items);
  });

  it('keeps the pinned item in place after a drag', () => {
    const { result } = renderHook(() =>
      useReorderableDraft([], items, {
        kind: 'pin_one',
        item: 'a',
        position: 0,
      }),
    );
    act(() => result.current.dragProps.onDragEnd(dragEnd('b', 'c')));
    expect(result.current.order).toEqual(['a', 'c', 'b']);
  });

  it('setOrder replaces the draft', () => {
    const { result } = renderHook(() =>
      useReorderableDraft([], items, undefined),
    );
    act(() => result.current.setOrder(['b', 'c', 'a']));
    expect(result.current.order).toEqual(['b', 'c', 'a']);
  });

  it('exposes pointer and keyboard sensors', () => {
    const { result } = renderHook(() =>
      useReorderableDraft([], items, undefined),
    );
    expect(result.current.dragProps.sensors).toHaveLength(2);
  });
});
