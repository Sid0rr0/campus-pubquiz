'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/** Whole entrance stays within 1.2 s: 0.2 + 0.4 first line, 0.4 + 0.4 second. */
export const TITLE_ENTRANCE = {
  kickerDelay: 0,
  kickerDuration: 0.4,
  titleDelay: 0.4,
  titleDuration: 0.6,
  offsetY: 28,
} as const;

interface EntranceLineProps {
  /** The round number line comes in first; the name slides in after it. */
  line: 'kicker' | 'title';
  className?: string;
  children: ReactNode;
}

/** One line of a round title entrance. Reduced motion: a plain crossfade. */
export function EntranceLine({ line, className, children }: EntranceLineProps) {
  const isReducedMotion = useReducedMotion();
  const isKicker = line === 'kicker';
  const delay = isReducedMotion
    ? 0
    : isKicker
      ? TITLE_ENTRANCE.kickerDelay
      : TITLE_ENTRANCE.titleDelay;
  const duration = isKicker
    ? TITLE_ENTRANCE.kickerDuration
    : TITLE_ENTRANCE.titleDuration;
  return (
    <motion.div
      className={className}
      initial={{
        opacity: 0,
        y: isReducedMotion || isKicker ? 0 : TITLE_ENTRANCE.offsetY,
        scale: isReducedMotion || !isKicker ? 1 : 0.85,
      }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
