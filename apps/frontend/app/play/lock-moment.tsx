'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { isGradedStatus, type GameStatus } from '@campus-pubquiz/types';
import { useOnLiveForwardMove } from '@/app/lib/live-change';
import { vibrate } from '@/app/lib/vibrate';

const BAR_TICK_MS = 250;
const STAMP_VISIBLE_MS = 2000;

/** Share of the bar's starting span still left before the deadline, clamped to 0..1. */
export function lockBarFraction(
  lockAt: number,
  now: number,
  spanMs: number,
): number {
  if (spanMs <= 0) return 0;
  return Math.min(1, Math.max(0, (lockAt - now) / spanMs));
}

// The span is the time left when the bar mounts (like the display's ring), so
// a phone that joins or reconnects mid-countdown resumes at the right fill.
function LockBar({ lockAt }: { lockAt: number }) {
  const [spanMs] = useState(() => Math.max(0, lockAt - Date.now()));
  const [fraction, setFraction] = useState(() =>
    lockBarFraction(lockAt, Date.now(), spanMs),
  );

  useEffect(() => {
    const tick = () => setFraction(lockBarFraction(lockAt, Date.now(), spanMs));
    tick();
    const interval = setInterval(tick, BAR_TICK_MS);
    return () => clearInterval(interval);
  }, [lockAt, spanMs]);

  return (
    <div
      role="progressbar"
      aria-label="Time left to answer"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
      className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-foreground/15"
    >
      <div
        className="h-full origin-left bg-magenta transition-transform duration-300 ease-linear"
        style={{ transform: `scaleX(${fraction})` }}
      />
    </div>
  );
}

interface LockStampProps {
  isVisible: boolean;
}

function LockStamp({ isVisible }: LockStampProps) {
  const shouldReduceMotion = useReducedMotion();
  if (!isVisible) return null;
  return (
    <motion.div
      role="status"
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      <span className="-rotate-6 rounded-xl border-4 border-magenta bg-background/90 px-6 py-2 font-display text-4xl uppercase text-magenta">
        Locked
      </span>
    </motion.div>
  );
}

interface LockMomentProps {
  status: GameStatus;
  /** Epoch-ms deadline the display counts down to, or null while none is armed. */
  lockAt: number | null;
  isConnected: boolean;
}

/**
 * The phone's lock moment: a bar draining to the lock deadline while the block
 * is locking, then a "Locked" stamp and a buzz when it locks. The stamp is a
 * one-off effect, so it follows the live-change rule (never on load,
 * reconnect or Previous).
 */
export function LockMoment({ status, lockAt, isConnected }: LockMomentProps) {
  const [isStampVisible, setIsStampVisible] = useState(false);

  useOnLiveForwardMove(isGradedStatus(status) ? 1 : 0, isConnected, () => {
    vibrate('lock');
    setIsStampVisible(true);
  });

  useEffect(() => {
    if (!isStampVisible) return;
    const timer = setTimeout(() => setIsStampVisible(false), STAMP_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [isStampVisible]);

  return (
    <>
      {status === 'locking' && lockAt !== null && (
        <LockBar key={lockAt} lockAt={lockAt} />
      )}
      <LockStamp isVisible={isStampVisible} />
    </>
  );
}
