import { POWER_UP_LABELS, type PowerUpCount } from '@campus-pubquiz/types';

/** "Power-ups used: 50/50 ×2" under a revealed answer; draws nothing when none was used. No team is named. */
export function PowerUpCounts({ counts }: { counts: PowerUpCount[] }) {
  if (counts.length === 0) return null;
  return (
    <p
      data-testid="power-up-counts"
      className="font-body text-2xl font-extrabold text-foreground/55"
    >
      Power-ups used:{' '}
      {counts
        .map(({ powerUp, count }) => `${POWER_UP_LABELS[powerUp]} ×${count}`)
        .join(' · ')}
    </p>
  );
}
