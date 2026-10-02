import type { AckResult, RatableRound } from '@campus-pubquiz/types';
import { RoundStarRows, useRoundRatings } from '@/app/play/round-star-rows';

interface FinalFeedbackFormProps {
  rounds: readonly RatableRound[];
  /** The ratings the server holds for this team, by round id — read once when the form mounts, so the page remounts it when a new join payload replaces them. */
  savedRatings: Readonly<Record<number, number>>;
  onRate: (roundId: number, stars: number) => Promise<AckResult>;
}

/** The final feedback form under "Quiz complete!": every round of the quiz with its stars, always open and editable. */
export function FinalFeedbackForm({
  rounds,
  savedRatings,
  onRate,
}: FinalFeedbackFormProps) {
  const { rows, rate } = useRoundRatings(savedRatings, onRate);

  return (
    <section
      aria-labelledby="final-feedback-heading"
      className="mx-auto mt-6 flex w-full max-w-md flex-col gap-3 rounded-lg border border-foreground/15 p-4"
    >
      <h2 id="final-feedback-heading" className="font-display text-lg">
        Rate the rounds
      </h2>
      <RoundStarRows
        rounds={rounds}
        rows={rows}
        onRate={(roundId, stars) => void rate(roundId, stars)}
      />
    </section>
  );
}
