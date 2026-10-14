'use client';

import type { ReactNode } from 'react';
import { MotionConfig, motion, type TargetAndTransition } from 'motion/react';

/**
 * How one piece of the answer comes in on the big screen's reveal. Only
 * `transform` and `opacity` move, and every kind is wrapped in a
 * reduced-motion config (see RevealEntranceConfig): under reduced motion the
 * transforms are skipped and what is left is a plain fade.
 */
export type EntranceKind =
  /** The typed or number answer line pops in. */
  | 'pop'
  /** The correct option lights up. */
  | 'light'
  /** The other options dim. */
  | 'dim'
  /** A sort item slides into its place. */
  | 'slide'
  /** A match pair settles into place. */
  | 'settle'
  /** A closest-guess step line slides in as it arrives. */
  | 'arrive';

interface EntranceMotion {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
}

const ITEM_STAGGER_S = 0.15;
const HIGHLIGHT_DELAY_S = 0.4;

const ENTRANCES: Record<EntranceKind, EntranceMotion> = {
  pop: {
    initial: { opacity: 0, scale: 0.7 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: { type: 'spring', stiffness: 260, damping: 14 },
    },
  },
  light: {
    initial: { scale: 1 },
    animate: {
      scale: [1, 1.07, 1],
      transition: { delay: HIGHLIGHT_DELAY_S, duration: 0.6 },
    },
  },
  dim: {
    initial: { opacity: 1 },
    animate: {
      opacity: 0.35,
      transition: { delay: HIGHLIGHT_DELAY_S, duration: 0.4 },
    },
  },
  slide: {
    initial: { opacity: 0, x: -48 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.4 } },
  },
  settle: {
    initial: { opacity: 0, y: -28, rotate: -1.5 },
    animate: {
      opacity: 1,
      y: 0,
      rotate: 0,
      transition: { type: 'spring', stiffness: 220, damping: 18 },
    },
  },
  arrive: {
    initial: { opacity: 0, x: -64 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.45 } },
  },
};

/** The item's motion with its place in the list folded into the delay, so a list comes in one after another. */
function entranceFor(kind: EntranceKind, index: number): EntranceMotion {
  const { initial, animate } = ENTRANCES[kind];
  if (index === 0) return { initial, animate };
  const transition = animate.transition ?? {};
  return {
    initial,
    animate: {
      ...animate,
      transition: {
        ...transition,
        delay: (transition.delay ?? 0) + index * ITEM_STAGGER_S,
      },
    },
  };
}

interface EntranceProps {
  /** False on the phone, which shows the same bodies without any motion. */
  hasEntrance: boolean | undefined;
  kind: EntranceKind;
  /** Position in a list; later items start a little later. */
  index?: number;
  className?: string;
  children: ReactNode;
}

export function EntranceItem({
  hasEntrance,
  kind,
  index = 0,
  className,
  children,
}: EntranceProps) {
  if (!hasEntrance) return <li className={className}>{children}</li>;
  const { initial, animate } = entranceFor(kind, index);
  return (
    <motion.li className={className} initial={initial} animate={animate}>
      {children}
    </motion.li>
  );
}

export function EntranceLine({
  hasEntrance,
  kind,
  index = 0,
  className,
  children,
}: EntranceProps) {
  if (!hasEntrance) return <p className={className}>{children}</p>;
  const { initial, animate } = entranceFor(kind, index);
  return (
    <motion.p className={className} initial={initial} animate={animate}>
      {children}
    </motion.p>
  );
}

/** Wraps a revealed answer so its entrances follow the viewer's reduced-motion setting. */
export function RevealEntranceConfig({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
