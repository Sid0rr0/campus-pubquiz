'use client';

import { useState } from 'react';
import { splitPipeList } from '@campus-pubquiz/types';

interface MatchAnswerProps {
  leftItems: string[];
  rightItems: string[];
  initialValue?: string;
  onSubmit: (value: string) => void;
}

/**
 * Match-pairs UI: one select per left item, drawing from the shared right
 * pool. Submits (as a `|`-joined string, positionally aligned to leftItems)
 * only once every row has a choice — a partial pairing isn't a real answer.
 */
export function MatchAnswer({
  leftItems,
  rightItems,
  initialValue,
  onSubmit,
}: MatchAnswerProps) {
  const restored = initialValue ? splitPipeList(initialValue) : [];
  const [selections, setSelections] = useState<string[]>(
    leftItems.map((_, index) =>
      restored.length === leftItems.length ? restored[index] : '',
    ),
  );

  function selectRight(itemIndex: number, right: string): void {
    const next = selections.map((current, i) =>
      i === itemIndex ? right : current,
    );
    setSelections(next);
    if (next.every((value) => value !== '')) {
      onSubmit(next.join('|'));
    }
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {leftItems.map((left, itemIndex) => {
        const chosen = selections[itemIndex];
        const usedElsewhere = new Set(
          selections.filter((value, i) => i !== itemIndex && value !== ''),
        );
        return (
          <li
            key={left}
            className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-foreground/30 bg-white px-4 text-lg font-bold"
          >
            <span className="flex-1 text-foreground">{left}</span>
            <select
              aria-label={`Match for ${left}`}
              value={chosen}
              onChange={(event) => selectRight(itemIndex, event.target.value)}
              className="min-w-0 rounded-lg border-2 border-foreground/25 bg-white px-2 py-1.5 text-base font-bold text-foreground"
            >
              <option value="">Choose…</option>
              {rightItems.map((right) => (
                <option
                  key={right}
                  value={right}
                  disabled={usedElsewhere.has(right)}
                >
                  {right}
                </option>
              ))}
            </select>
          </li>
        );
      })}
    </ul>
  );
}
