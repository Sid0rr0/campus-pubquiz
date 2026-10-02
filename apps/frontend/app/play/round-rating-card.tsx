import { useState } from 'react';
import type { AckResult, RatableRound } from '@campus-pubquiz/types';
import {
  isEveryRoundSaved,
  RoundStarRows,
  useRoundRatings,
} from '@/app/play/round-star-rows';

interface RoundRatingCardProps {
  rounds: readonly RatableRound[];
  /** The ratings the server holds for this team, by round id — read once when the card mounts, so the page remounts it when a new join payload replaces them. */
  savedRatings: Readonly<Record<number, number>>;
  onRate: (roundId: number, stars: number) => Promise<AckResult>;
}

/**
 * "Rate these rounds": one star row per round the server lists. When every
 * listed round is saved the card collapses to "Rated ✓ · edit".
 */
export function RoundRatingCard({
  rounds,
  savedRatings,
  onRate,
}: RoundRatingCardProps) {
  const { rows, rate } = useRoundRatings(savedRatings, onRate);
  const [isEditing, setIsEditing] = useState(false);

  if (isEveryRoundSaved(rounds, rows) && !isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="mb-4 w-full rounded-lg border border-foreground/15 px-4 py-2 text-left text-sm font-extrabold text-foreground/70"
      >
        Rated ✓ · edit
      </button>
    );
  }

  return (
    <section
      aria-labelledby="rate-the-rounds-heading"
      className="mb-4 flex w-full flex-col gap-3 rounded-lg border border-foreground/15 p-4"
    >
      <h2 id="rate-the-rounds-heading" className="font-display text-lg">
        Rate these rounds
      </h2>
      <RoundStarRows
        rounds={rounds}
        rows={rows}
        onRate={(roundId, stars) => void rate(roundId, stars)}
      />
    </section>
  );
}
