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
import { DragHandleDots2Icon } from '@radix-ui/react-icons';
import { splitPipeList } from '@campus-pubquiz/types';
import { reorderOnDragEnd } from '@/app/lib/reorder-list';

interface MatchAnswerProps {
  leftItems: string[];
  rightItems: string[];
  initialValue?: string;
  onSubmit: (value: string) => void;
}

interface MatchRightRowProps {
  value: string;
  animatePositionChange: boolean;
}

/** One draggable right-hand cell — reordering this column is how a team pairs a right item with the fixed left-hand row beside it. */
function MatchRightRow({ value, animatePositionChange }: MatchRightRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: value });

  return (
    <motion.li
      ref={setNodeRef}
      // See the identical layout-vs-drag-transform comment in sort-answer.tsx.
      layout={animatePositionChange}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex min-h-14 items-center gap-2 bg-white px-4 text-lg font-bold text-foreground"
    >
      <span className="flex-1">{value}</span>
      <button
        type="button"
        aria-label={`Drag to reorder ${value}`}
        className="flex shrink-0 cursor-grab touch-none items-center justify-center text-foreground/40 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <DragHandleDots2Icon aria-hidden="true" />
      </button>
    </motion.li>
  );
}

/**
 * Match-pairs UI: the left column is fixed; dragging (or keyboard-reordering)
 * the right column is how a team pairs each right item with the left row
 * beside it. Submits as a `|`-joined string, positionally aligned to
 * leftItems, on every reorder.
 */
export function MatchAnswer({
  leftItems,
  rightItems,
  initialValue,
  onSubmit,
}: MatchAnswerProps) {
  const restored = initialValue ? splitPipeList(initialValue) : [];
  const [order, setOrder] = useState<string[]>(
    restored.length === rightItems.length ? restored : rightItems,
  );
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
    setOrder(next);
    onSubmit(next.join('|'));
  }

  return (
    <div className="flex overflow-hidden rounded-2xl border-2 border-foreground/30 bg-white">
      <ul className="flex flex-1 flex-col divide-y divide-foreground/15 border-r-2 border-foreground/15">
        {leftItems.map((left) => (
          <li
            key={left}
            className="flex min-h-14 items-center px-4 text-lg font-bold text-foreground"
          >
            {left}
          </li>
        ))}
      </ul>
      {/* A static id keeps dnd-kit's aria-describedby id deterministic across SSR/hydration — see the identical comment in sort-answer.tsx. */}
      <DndContext
        id="match-answer"
        sensors={sensors}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setIsDragging(false)}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-1 flex-col divide-y divide-foreground/15">
            {order.map((value) => (
              <MatchRightRow
                key={value}
                value={value}
                animatePositionChange={!isDragging}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}
