'use client';

import { useEffect, useState } from 'react';

const TICK_MS = 250;

function secondsUntil(endsAt: number): number {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

/**
 * Whole seconds left until the server's deadline `endsAt` (epoch-ms), counting
 * down to 0; null while there is no deadline. Reads the clock against the
 * server's own deadline, so a phone that joins or reconnects mid-countdown
 * shows the time actually left.
 */
export function useSecondsLeft(endsAt: number | null): number | null {
  const [seconds, setSeconds] = useState<number | null>(() =>
    endsAt === null ? null : secondsUntil(endsAt),
  );

  useEffect(() => {
    if (endsAt === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSeconds(null);
      return;
    }
    const tick = () => setSeconds(secondsUntil(endsAt));
    tick();
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [endsAt]);

  return seconds;
}

/** `42` as "0:42". */
export function formatSecondsLeft(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
