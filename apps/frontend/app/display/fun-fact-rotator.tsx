'use client';

import { useEffect, useState } from 'react';
import type { FunFact } from '@campus-pubquiz/types';
import { describeFunFactLine } from '@/app/display/fun-fact-wording';

/** How long each fun fact stays on the break screen before the next one fades in. */
export const FUN_FACT_ROTATE_MS = 8000;

const DEFAULT_FUN_FACT_START_DELAY_MS = 60_000;

/** A build-time override (the E2E build sets it so a journey doesn't wait a minute); anything but a positive whole number keeps the default. */
function readStartDelayMs(): number {
  const override = Number(process.env.NEXT_PUBLIC_FUN_FACT_START_DELAY_MS);
  return Number.isInteger(override) && override > 0
    ? override
    : DEFAULT_FUN_FACT_START_DELAY_MS;
}

/** How long the break screen is on air, from when the rotator mounts, before the first fun fact appears. A display reload restarts the wait. */
export const FUN_FACT_START_DELAY_MS = readStartDelayMs();

interface FunFactRotatorProps {
  funFacts: FunFact[];
}

/** Shows the fun facts one at a time, starting FUN_FACT_START_DELAY_MS after mount and then rotating every FUN_FACT_ROTATE_MS; renders nothing for an empty list and never rotates a single fact. */
export function FunFactRotator({ funFacts }: FunFactRotatorProps) {
  const [index, setIndex] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const factCount = funFacts.length;

  useEffect(() => {
    const timer = setTimeout(() => setIsStarted(true), FUN_FACT_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isStarted || factCount < 2) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % factCount),
      FUN_FACT_ROTATE_MS,
    );
    return () => clearInterval(timer);
  }, [isStarted, factCount]);

  if (!isStarted || factCount === 0) return null;
  // The list can shrink between broadcasts; wrap rather than index past its end.
  const position = index % factCount;
  const { headline, detail, prompt, answer } = describeFunFactLine(
    funFacts[position],
  );

  return (
    <div
      key={position}
      data-testid="fun-fact"
      className="flex max-w-5xl animate-fun-fact-in flex-col items-center gap-2 motion-reduce:animate-fun-fact-fade"
    >
      <p className="text-balance font-display text-display-4xl">{headline}</p>
      <p className="font-display text-display-xl text-foreground/70">
        {detail}
      </p>
      {prompt && (
        <p className="text-balance text-display-lg text-foreground/55">
          {prompt}
        </p>
      )}
      {answer && (
        <p className="line-clamp-2 text-balance text-display-lg text-foreground/70">
          Answer: <span className="font-bold">{answer}</span>
        </p>
      )}
    </div>
  );
}
