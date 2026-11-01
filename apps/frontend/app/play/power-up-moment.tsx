'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { LightningBoltIcon } from '@radix-ui/react-icons';
import { POWER_UP_LABELS, type PowerUpId } from '@campus-pubquiz/types';

const MOMENT_VISIBLE_MS = 1200;
const STAMP_EASE = [0.16, 1, 0.3, 1] as const;

interface PowerUpMomentState {
  id: number;
  powerUp: PowerUpId;
  cost: number;
}

/**
 * Raises the power-up stamp when the server accepted a purchase. It answers the
 * team's own action, so like "Saved ✓" it is not a live-change effect: a load or
 * reconnect, which only re-sends the purchases, never plays it.
 */
export function usePowerUpMoment() {
  const [moment, setMoment] = useState<PowerUpMomentState | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  const showMoment = useCallback((powerUp: PowerUpId, cost: number) => {
    setMoment((previous) => ({
      id: (previous?.id ?? 0) + 1,
      powerUp,
      cost,
    }));
    if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setMoment(null), MOMENT_VISIBLE_MS);
  }, []);

  return { moment, showMoment };
}

/** The stamp itself: the card lands as the bolt strikes down through it. Never takes a tap, so answering carries on under it. */
export function PowerUpMoment({
  moment,
}: {
  moment: PowerUpMomentState | null;
}) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {moment && (
        <motion.div
          key={moment.id}
          role="status"
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          initial={
            shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.6 }
          }
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: 0.25, ease: STAMP_EASE }}
        >
          <span className="flex -rotate-3 flex-col items-center gap-1 rounded-2xl border-4 border-magenta bg-background/95 px-8 py-4 text-magenta">
            <motion.span
              aria-hidden="true"
              initial={
                shouldReduceMotion ? false : { clipPath: 'inset(0 0 100% 0)' }
              }
              animate={{ clipPath: 'inset(0 0 0% 0)' }}
              transition={{ delay: 0.12, duration: 0.2, ease: 'easeOut' }}
            >
              <LightningBoltIcon className="size-9" />
            </motion.span>
            <span className="whitespace-nowrap font-display text-3xl">
              {POWER_UP_LABELS[moment.powerUp]}
            </span>
            {moment.cost > 0 && (
              <span className="text-sm font-black tabular-nums">
                −{moment.cost} {moment.cost === 1 ? 'coin' : 'coins'}
              </span>
            )}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
