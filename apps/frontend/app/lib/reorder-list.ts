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

/** Same reducer as {@link reorderOnDragEnd}, generalized to a list of `id`-bearing objects — shared by the quiz outline's round and question drag-and-drop. */
export function reorderById<T extends { id: string }>(
  items: T[],
  activeId: string,
  overId: string,
): T[] | null {
  if (activeId === overId) return null;
  const oldIndex = items.findIndex((item) => item.id === activeId);
  const newIndex = items.findIndex((item) => item.id === overId);
  if (oldIndex === -1 || newIndex === -1) return null;
  return arrayMove(items, oldIndex, newIndex);
}
