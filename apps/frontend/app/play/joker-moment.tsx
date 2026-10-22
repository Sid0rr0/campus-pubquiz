'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { screenPositionOf, type GameProgress } from '@campus-pubquiz/types';
import { useOnLiveForwardMove } from '@/app/lib/live-change';

const CARD_VISIBLE_MS = 2200;

/** The small static joker badge that marks the joker round's title card when it comes back (break round intro, reveal intro). */
export function JokerBadge() {
  return (
    <p
      data-testid="joker-badge"
      className="rounded-full border-2 border-yellow px-3 py-1 text-sm font-extrabold tracking-wide text-yellow"
    >
      🃏 Joker round · 2×
    </p>
  );
}

interface JokerMomentProps {
  progress: GameProgress;
  /** Whether the title card on screen is the intro of the team's joker round. */
  isJokerIntro: boolean;
  isConnected: boolean;
}

/**
 * The phone's joker moment: a "2× POINTS" joker card when the team's joker
 * round's intro comes on live. A one-off effect, so it follows the
 * live-change rule like the "Locked" stamp: never on load, reconnect or
 * Previous. It reacts to the quiz moving forward onto the intro, not to the
 * intro merely being on screen.
 */
export function JokerMoment({
  progress,
  isJokerIntro,
  isConnected,
}: JokerMomentProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isCardVisible, setIsCardVisible] = useState(false);

  useOnLiveForwardMove(screenPositionOf(progress), isConnected, () => {
    if (isJokerIntro) setIsCardVisible(true);
  });

  useEffect(() => {
    if (!isCardVisible) return;
    const timer = setTimeout(() => setIsCardVisible(false), CARD_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [isCardVisible]);

  if (!isCardVisible) return null;
  return (
    <motion.div
      role="status"
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
      initial={
        shouldReduceMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.4, rotate: -12 }
      }
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: 0.35 }}
    >
      <span className="flex flex-col items-center gap-1 rounded-2xl border-4 border-yellow bg-background/95 px-8 py-5 font-display text-4xl uppercase text-yellow">
        <span aria-hidden="true">🃏</span>
        <span>2× POINTS</span>
      </span>
    </motion.div>
  );
}
