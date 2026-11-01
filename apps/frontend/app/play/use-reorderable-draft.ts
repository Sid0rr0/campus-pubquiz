import { useState } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { lockPin, type PinEffect } from '@campus-pubquiz/types';
import { reorderOnDragEnd } from '@/app/lib/reorder-list';

/**
 * The draft order of a sort or match answer and the drag handling around it:
 * starts from the order already submitted when it still fits `items`, else
 * from `items`. A bought pin is applied on every read, so a pin bought while
 * the question is open snaps its item into place at once.
 */
export function useReorderableDraft(
  restoredOrder: string[],
  items: string[],
  pin: PinEffect | undefined,
) {
  const [draft, setDraft] = useState<string[]>(
    restoredOrder.length === items.length ? restoredOrder : items,
  );
  const order = lockPin(draft, pin);
  const [isDragging, setIsDragging] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent): void {
    setIsDragging(false);
    const { active, over } = event;
    if (!over) return;
    const next = reorderOnDragEnd(order, String(active.id), String(over.id));
    if (!next) return;
    setDraft(lockPin(next, pin));
  }

  return {
    order,
    setOrder: setDraft,
    isDragging,
    /** Props for the `DndContext` around the list. */
    dragProps: {
      sensors,
      onDragStart: () => setIsDragging(true),
      onDragEnd: handleDragEnd,
      onDragCancel: () => setIsDragging(false),
    },
  };
}
