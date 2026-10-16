'use client';

import { useEffect, useState } from 'react';
import type { FunFact } from '@campus-pubquiz/types';
import { describeFunFactLine } from '@/app/display/fun-fact-wording';

/** How long each fun fact stays on the break screen before the next one fades in. */
export const FUN_FACT_ROTATE_MS = 8000;

interface FunFactRotatorProps {
  funFacts: FunFact[];
}

/** Shows the fun facts one at a time, rotating every FUN_FACT_ROTATE_MS; renders nothing for an empty list and never rotates a single fact. */
export function FunFactRotator({ funFacts }: FunFactRotatorProps) {
  const [index, setIndex] = useState(0);
  const factCount = funFacts.length;

  useEffect(() => {
    if (factCount < 2) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % factCount),
      FUN_FACT_ROTATE_MS,
    );
    return () => clearInterval(timer);
  }, [factCount]);

  if (factCount === 0) return null;
  // The list can shrink between broadcasts; wrap rather than index past its end.
  const position = index % factCount;
  const { headline, detail, prompt } = describeFunFactLine(funFacts[position]);

  return (
    <div
      key={position}
      data-testid="fun-fact"
      className="flex max-w-5xl animate-fun-fact-in flex-col items-center gap-2 motion-reduce:animate-none"
    >
      <p className="text-balance font-display text-display-6xl">{headline}</p>
      <p className="font-display text-display-2xl text-foreground/70">
        {detail}
      </p>
      {prompt && (
        <p className="text-balance text-display-xl text-foreground/55">
          {prompt}
        </p>
      )}
    </div>
  );
}
