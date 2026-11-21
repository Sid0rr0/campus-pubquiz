import type {
  AckResult,
  RatableRound,
  RateSessionPayload,
  SendFeedbackPayload,
  TeamFeedbackView,
  TeamSessionRatingsView,
} from '@campus-pubquiz/types';
import { FeedbackTextForm } from '@/app/play/feedback-text-form';
import { RoundStarRows, useRoundRatings } from '@/app/play/round-star-rows';
import { SessionScaleRows } from '@/app/play/session-scale-rows';

interface FinalFeedbackFormProps {
  rounds: readonly RatableRound[];
  /** The ratings the server holds for this team, by round id. */
  savedRatings: Readonly<Record<number, number>>;
  onRate: (roundId: number, stars: number) => Promise<AckResult>;
  /** The pacing and felt-difficulty answers the server holds for this team. */
  savedSessionRatings: TeamSessionRatingsView;
  onRateSession: (rating: RateSessionPayload) => Promise<AckResult>;
  /** The comment and topics the server holds for this team. */
  savedFeedback: TeamFeedbackView;
  onSendFeedback: (feedback: SendFeedbackPayload) => Promise<AckResult>;
}

interface FinalRatingRowsProps {
  rounds: readonly RatableRound[];
  savedRatings: Readonly<Record<number, number>>;
  onRate: (roundId: number, stars: number) => Promise<AckResult>;
}

/** The star rows, following the saved ratings except where a tap is waiting. */
function FinalRatingRows({
  rounds,
  savedRatings,
  onRate,
}: FinalRatingRowsProps) {
  const { rows, rate } = useRoundRatings(savedRatings, onRate);
  return (
    <RoundStarRows
      rounds={rounds}
      rows={rows}
      onRate={(roundId, stars) => void rate(roundId, stars)}
    />
  );
}

/** The final feedback form under "Quiz complete!": pacing and felt difficulty, every round of the quiz with its stars, then the comment and topic suggestions. Always open and editable. */
export function FinalFeedbackForm({
  rounds,
  savedRatings,
  onRate,
  savedSessionRatings,
  onRateSession,
  savedFeedback,
  onSendFeedback,
}: FinalFeedbackFormProps) {
  return (
    <section
      aria-labelledby="final-feedback-heading"
      className="mx-auto mt-6 flex w-full max-w-md flex-col gap-3 rounded-lg border border-foreground/15 p-4"
    >
      <SessionScaleRows saved={savedSessionRatings} onRate={onRateSession} />
      <h2 id="final-feedback-heading" className="font-display text-lg">
        Rate the rounds
      </h2>
      <FinalRatingRows
        rounds={rounds}
        savedRatings={savedRatings}
        onRate={onRate}
      />
      <FeedbackTextForm saved={savedFeedback} onSend={onSendFeedback} />
    </section>
  );
}
