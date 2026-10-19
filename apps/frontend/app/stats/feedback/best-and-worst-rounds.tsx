import {
  MIN_RATINGS_FOR_RANKING,
  type FeedbackTrends,
  type FeedbackTrendsRound,
} from '@campus-pubquiz/types';

interface BestAndWorstRoundsProps {
  bestRounds: FeedbackTrends['bestRounds'];
  worstRounds: FeedbackTrends['worstRounds'];
}

function RoundList({
  title,
  rounds,
}: {
  title: string;
  rounds: FeedbackTrendsRound[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-display text-base">{title}</h3>
      {rounds.length === 0 ? (
        <p className="text-foreground/50">Not enough ratings yet</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rounds.map((round) => (
            <li
              key={`${round.sessionId}-${round.roundTitle}`}
              className="flex items-baseline justify-between gap-3 rounded-xl border border-foreground/15 px-4 py-2"
            >
              <span className="flex flex-col">
                <span>{round.roundTitle}</span>
                <span className="text-sm text-foreground/60">
                  {round.sessionName}
                </span>
              </span>
              <span className="whitespace-nowrap text-sm">
                ★ {round.average.toFixed(1)} · {round.count} ratings
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** The top and bottom rounds by average rating across the range; rounds with too few ratings are left out. */
export function BestAndWorstRounds({
  bestRounds,
  worstRounds,
}: BestAndWorstRoundsProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg">Best and worst rounds</h2>
      <p className="text-sm text-foreground/60">
        Rounds with at least {MIN_RATINGS_FOR_RANKING} ratings.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <RoundList title="Best rounds" rounds={bestRounds} />
        <RoundList title="Worst rounds" rounds={worstRounds} />
      </div>
    </section>
  );
}
