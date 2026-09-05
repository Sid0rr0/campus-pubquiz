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
import { CheckIcon, DragHandleDots2Icon } from '@radix-ui/react-icons';
import { splitPipeList } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { reorderOnDragEnd } from '@/app/lib/reorder-list';

interface MatchAnswerProps {
  leftItems: string[];
  rightItems: string[];
  initialValue?: string;
  onSubmit: (value: string) => void;
}

interface MatchRightRowProps {
  value: string;
  index: number;
  animatePositionChange: boolean;
}

/**
 * One draggable right-hand cell — reordering this column is how a team pairs
 * a right item with the fixed left-hand row beside it. Placed on the shared
 * grid at `index` so it always occupies the same grid row as the left-hand
 * cell it's paired with, keeping the two columns aligned even when one
 * cell's text wraps to multiple lines.
 */
function MatchRightRow({
  value,
  index,
  animatePositionChange,
}: MatchRightRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: value });

  return (
    <motion.li
      ref={setNodeRef}
      // See the identical layout-vs-drag-transform comment in sort-answer.tsx.
      layout={animatePositionChange}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        gridRow: index + 1,
        gridColumn: 2,
      }}
      className="flex min-h-16 items-center gap-2 bg-white py-1 pr-1 pl-4 text-lg font-bold text-foreground not-first:border-t-2 not-first:border-t-foreground/15"
    >
      <span className="flex-1">{value}</span>
      <button
        type="button"
        aria-label={`Drag to reorder ${value}`}
        className="flex h-12 w-12 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-foreground/40 active:cursor-grabbing active:bg-foreground/10"
        {...attributes}
        {...listeners}
      >
        <DragHandleDots2Icon aria-hidden="true" className="h-7 w-7" />
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
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden rounded-2xl border-2 border-foreground/30 bg-white">
        <ul className="contents">
          {leftItems.map((left, index) => (
            <li
              key={left}
              style={{ gridRow: index + 1, gridColumn: 1 }}
              className="flex min-h-16 items-center border-r-2 border-foreground/15 px-4 text-lg font-bold text-foreground not-first:border-t-2 not-first:border-t-foreground/15"
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
            <ol className="contents">
              {order.map((value, index) => (
                <MatchRightRow
                  key={value}
                  value={value}
                  index={index}
                  animatePositionChange={!isDragging}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </div>
      <Button
        type="button"
        variant="solid"
        onClick={() => onSubmit(order.join('|'))}
        className="flex min-h-14 items-center justify-center gap-2 rounded-2xl text-lg"
      >
        <CheckIcon aria-hidden="true" />
        Submit
      </Button>
    </div>
  );
}
