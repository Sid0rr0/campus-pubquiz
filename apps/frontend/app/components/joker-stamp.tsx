import { motion, useReducedMotion } from 'motion/react';

interface JokerStampProps {
  /** Whether the stamp slams down (a rank revealed live) or is simply there (a reload, the phone). */
  isLanding?: boolean;
  /** The stamp's size on the big screen, which scales with the display text. */
  className?: string;
}

/** The "2×" joker stamp on a leaderboard row: the team's joker round was in the block just scored. */
export function JokerStamp({
  isLanding = false,
  className = 'text-display-2xl',
}: JokerStampProps) {
  const isReducedMotion = useReducedMotion() ?? false;
  const shouldAnimate = isLanding && !isReducedMotion;
  return (
    <motion.span
      role="img"
      aria-label="Joker 2×"
      data-stamp={isLanding ? 'landing' : 'settled'}
      initial={shouldAnimate ? { scale: 3, rotate: -25, opacity: 0 } : false}
      animate={{ scale: 1, rotate: -8, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      className={`inline-block shrink-0 rounded-lg border-[3px] border-magenta px-2 font-display font-extrabold text-magenta ${className}`}
    >
      2×
    </motion.span>
  );
}
