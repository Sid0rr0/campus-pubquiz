'use client';

import { useEffect, useState } from 'react';

const TICK_INTERVAL_MS = 1_000;

interface PhaseTimerProps {
  /** Epoch-ms the currently-displayed question/break started, or null when it isn't live — see the component doc comment below. */
  phaseStartedAt: number | null;
  /** Final elapsed-ms for the currently-displayed question/break, or null when it's still live or the current status isn't timed at all. */
  phaseElapsedMs: number | null;
  className?: string;
}

/** "m:ss" — no hour digit needed, a quiz question/break never runs that long. */
function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Elapsed-time display for the admin: ticks up live from `phaseStartedAt`
 * while the currently-displayed question/break is still the live frontier,
 * or shows a final, no-longer-ticking `phaseElapsedMs` once it's been
 * superseded by something genuinely new. Renders nothing when neither
 * applies (an untimed status, e.g. reveal).
 */
export function PhaseTimer({
  phaseStartedAt,
  phaseElapsedMs,
  className = '',
}: PhaseTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (phaseStartedAt === null) return;
    const interval = setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phaseStartedAt]);

  if (phaseStartedAt !== null) {
    return (
      <div
        data-testid="phase-timer"
        className={`font-display text-2xl tabular-nums ${className}`}
      >
        {formatElapsed(now - phaseStartedAt)}
      </div>
    );
  }

  if (phaseElapsedMs !== null) {
    return (
      <div
        data-testid="phase-timer"
        className={`font-display text-2xl tabular-nums opacity-70 ${className}`}
      >
        {formatElapsed(phaseElapsedMs)}
      </div>
    );
  }

  return null;
}
