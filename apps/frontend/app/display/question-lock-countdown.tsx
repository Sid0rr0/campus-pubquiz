'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

const LOCK_RING_RADIUS = 45;
const LOCK_RING_CIRCUMFERENCE = 2 * Math.PI * LOCK_RING_RADIUS;

interface QuestionLockCountdownProps {
  /** Epoch-ms deadline when the question auto-locks. */
  lockAt: number;
}

// Ring duration is derived from the remaining time at mount, not a hardcoded
// 60s, so a display that reconnects mid-countdown resumes at the correct
// fraction instead of restarting a full sweep.
export function QuestionLockCountdown({ lockAt }: QuestionLockCountdownProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    Math.max(0, Math.ceil((lockAt - Date.now()) / 1000)),
  );
  // Captured once at mount so the ring's animation duration reflects however
  // much time was actually left (e.g. after a reconnect mid-countdown),
  // rather than recomputing (and therefore restarting) on every re-render.
  const [remainingMs] = useState(() => Math.max(0, lockAt - Date.now()));

  useEffect(() => {
    const tick = () =>
      setSecondsRemaining(Math.max(0, Math.ceil((lockAt - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [lockAt]);

  return (
    <div
      data-testid="question-lock-countdown"
      className="relative flex h-24 w-24 items-center justify-center"
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={LOCK_RING_RADIUS}
          strokeWidth="8"
          className="fill-none stroke-foreground/15"
        />
        <motion.circle
          cx="50"
          cy="50"
          r={LOCK_RING_RADIUS}
          strokeWidth="8"
          strokeLinecap="round"
          className="fill-none stroke-magenta"
          strokeDasharray={LOCK_RING_CIRCUMFERENCE}
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: LOCK_RING_CIRCUMFERENCE }}
          transition={{ duration: remainingMs / 1000, ease: 'linear' }}
        />
      </svg>
      <span className="absolute font-display text-2xl text-foreground">
        {secondsRemaining}
      </span>
    </div>
  );
}
