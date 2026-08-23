'use client';

import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'motion/react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DragHandleDots2Icon,
} from '@radix-ui/react-icons';
import { splitPipeList } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { reorderOnDragEnd } from '@/app/lib/reorder-list';

interface SortAnswerProps {
  options: string[];
  initialValue?: string;
  onSubmit: (value: string) => void;
}

interface SortItemProps {
  item: string;
  itemIndex: number;
  itemCount: number;
  onMove: (itemIndex: number, direction: -1 | 1) => void;
  animatePositionChange: boolean;
}

/** One reorderable row — the drag handle carries dnd-kit's listeners so dragging never swallows clicks on the up/down buttons. */
function SortItem({
  item,
  itemIndex,
  itemCount,
  onMove,
  animatePositionChange,
}: SortItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item });

  return (
    <motion.li
      ref={setNodeRef}
      // Layout animation is disabled during an active drag so it never fights dnd-kit's own transform/transition above — dnd-kit already animates every item's live drag preview itself. It only takes over once the drag ends (a no-op re-animation, since the item is already where it should be) or when the up/down buttons move an item with no drag involved.
      layout={animatePositionChange}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-foreground/30 bg-white px-4 text-lg font-bold"
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${item}`}
        className="flex shrink-0 cursor-grab touch-none items-center justify-center text-foreground/40 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <DragHandleDots2Icon aria-hidden="true" />
      </button>
      <span aria-hidden="true" className="font-display text-cyan">
        {itemIndex + 1}
      </span>
      <span className="flex-1 text-foreground">{item}</span>
      <Button
        type="button"
        aria-label={`Move ${item} up`}
        onClick={() => onMove(itemIndex, -1)}
        disabled={itemIndex === 0}
        variant="icon"
        size="icon-lg"
      >
        <ArrowUpIcon aria-hidden="true" />
      </Button>
      <Button
        type="button"
        aria-label={`Move ${item} down`}
        onClick={() => onMove(itemIndex, 1)}
        disabled={itemIndex === itemCount - 1}
        variant="icon"
        size="icon-lg"
      >
        <ArrowDownIcon aria-hidden="true" />
      </Button>
    </motion.li>
  );
}

/** Reorder-in-place UI for `sort` questions — drag handle or up/down buttons, either way every move immediately re-submits the current order. */
export function SortAnswer({
  options,
  initialValue,
  onSubmit,
}: SortAnswerProps) {
  const restoredOrder = initialValue ? splitPipeList(initialValue) : [];
  const [order, setOrder] = useState<string[]>(
    restoredOrder.length === options.length ? restoredOrder : options,
  );
  const [isDragging, setIsDragging] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function move(itemIndex: number, direction: -1 | 1): void {
    const targetIndex = itemIndex + direction;
    if (targetIndex < 0 || targetIndex >= order.length) return;
    const next = [...order];
    [next[itemIndex], next[targetIndex]] = [next[targetIndex], next[itemIndex]];
    setOrder(next);
    onSubmit(next.join('|'));
  }

  function handleDragEnd(event: DragEndEvent): void {
    setIsDragging(false);
    const { active, over } = event;
    if (!over) return;
    const next = reorderOnDragEnd(order, String(active.id), String(over.id));
    if (!next) return;
    setOrder(next);
    onSubmit(next.join('|'));
  }

  return (
    // A static id keeps dnd-kit's aria-describedby id deterministic across SSR/hydration — without it dnd-kit falls back to a shared mutable module counter that drifts between the server and client render, causing a hydration mismatch.
    <DndContext
      id="sort-answer"
      sensors={sensors}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setIsDragging(false)}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-2.5">
          {order.map((item, itemIndex) => (
            <SortItem
              key={item}
              item={item}
              itemIndex={itemIndex}
              itemCount={order.length}
              onMove={move}
              animatePositionChange={!isDragging}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
