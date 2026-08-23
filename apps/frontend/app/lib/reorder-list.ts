import { arrayMove } from '@dnd-kit/sortable';

/** Pure drag-end reducer shared by `sort` and `match` questions — dnd-kit's own collision detection (which this doesn't touch) isn't ours to test. */
export function reorderOnDragEnd(
  order: string[],
  activeId: string,
  overId: string,
): string[] | null {
  if (activeId === overId) return null;
  const oldIndex = order.indexOf(activeId);
  const newIndex = order.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1) return null;
  return arrayMove(order, oldIndex, newIndex);
}
