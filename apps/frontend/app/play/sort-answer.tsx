'use client';

import { useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon } from '@radix-ui/react-icons';
import { splitPipeList } from '@campus-pubquiz/types';

interface SortAnswerProps {
  options: string[];
  initialValue?: string;
  onSubmit: (value: string) => void;
}

/** Reorder-in-place UI for `sort` questions — each move immediately re-submits the current order, mirroring the multiple_choice click-to-submit pattern. */
export function SortAnswer({
  options,
  initialValue,
  onSubmit,
}: SortAnswerProps) {
  const restoredOrder = initialValue ? splitPipeList(initialValue) : [];
  const [order, setOrder] = useState<string[]>(
    restoredOrder.length === options.length ? restoredOrder : options,
  );

  function move(itemIndex: number, direction: -1 | 1): void {
    const targetIndex = itemIndex + direction;
    if (targetIndex < 0 || targetIndex >= order.length) return;
    const next = [...order];
    [next[itemIndex], next[targetIndex]] = [next[targetIndex], next[itemIndex]];
    setOrder(next);
    onSubmit(next.join('|'));
  }

  return (
    <ol className="flex flex-col gap-2.5">
      {order.map((item, itemIndex) => (
        <li
          key={item}
          className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-foreground/30 bg-white px-4 text-lg font-bold"
        >
          <span aria-hidden="true" className="font-display text-cyan">
            {itemIndex + 1}
          </span>
          <span className="flex-1 text-foreground">{item}</span>
          <button
            type="button"
            aria-label={`Move ${item} up`}
            onClick={() => move(itemIndex, -1)}
            disabled={itemIndex === 0}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-foreground/20 font-extrabold disabled:opacity-30"
          >
            <ArrowUpIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Move ${item} down`}
            onClick={() => move(itemIndex, 1)}
            disabled={itemIndex === order.length - 1}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-foreground/20 font-extrabold disabled:opacity-30"
          >
            <ArrowDownIcon aria-hidden="true" />
          </button>
        </li>
      ))}
    </ol>
  );
}
