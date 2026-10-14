'use client';

import { useEffect, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import type { TeamsCorrect } from '@campus-pubquiz/types';

const COUNT_UP_MS = 900;

/** A whole number that counts up from 0 to `value` once, and snaps to it under reduced motion. */
function useCountUp(value: number): number {
  const isReducedMotion = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (isReducedMotion) return undefined;
    const controls = animate(0, value, {
      duration: COUNT_UP_MS / 1000,
      ease: 'easeOut',
      onUpdate: (latest) => setShown(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value, isReducedMotion]);

  return isReducedMotion ? value : shown;
}

/**
 * "7 of 12 teams" counting up under a revealed answer, with "+2 close" when
 * some teams were partly right. The server worked the numbers out; this only
 * draws them. A static copy is kept for screen readers.
 */
export function TeamsCorrectCount({
  correct,
  partial,
  teamCount,
}: TeamsCorrect) {
  const shown = useCountUp(correct);
  const total = `${correct} of ${teamCount} teams`;
  return (
    <p
      data-testid="teams-correct"
      className="font-display text-display-2xl text-green"
    >
      <span aria-hidden="true">{`${shown} of ${teamCount} teams`}</span>
      <span className="sr-only">{total}</span>
      {partial > 0 && (
        <span className="ml-4 text-cyan">{`+${partial} close`}</span>
      )}
    </p>
  );
}
