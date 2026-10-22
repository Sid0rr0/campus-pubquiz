'use client';

import type { JokerPickRound } from '@campus-pubquiz/types';
import { formatSecondsLeft, useSecondsLeft } from '@/app/lib/use-seconds-left';

interface JokerPickScreenProps {
  /** Epoch-ms deadline the pick closes at, or null once it has closed. */
  endsAt: number | null;
  /** Every round of the quiz. */
  rounds: JokerPickRound[];
}

/**
 * The big screen while teams pick their joker round: every round listed like
 * the overview, and the server's countdown. It never shows which round any
 * team picked.
 */
export function JokerPickScreen({ endsAt, rounds }: JokerPickScreenProps) {
  const secondsLeft = useSecondsLeft(endsAt);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-16 text-center">
      <h1 className="font-display text-display-3xl">
        <span className="text-magenta">Pick your joker</span>
      </h1>
      <p className="text-display-xl font-bold text-foreground/70">
        Choose a round on your phone: its points count double.
      </p>
      {secondsLeft !== null && (
        <p
          role="timer"
          aria-label="Time left to pick a joker"
          className="font-display text-display-4xl text-cyan"
        >
          {formatSecondsLeft(secondsLeft)}
        </p>
      )}
      <ol className="mx-auto flex max-w-[calc(36rem*var(--display-text-scale,1))] flex-col gap-3 text-left">
        {rounds.map((round) => (
          <li
            key={round.roundId}
            className="flex items-start gap-3 text-display-2xl font-bold"
          >
            <span aria-hidden="true" className="text-cyan">
              {round.roundNumber}.
            </span>
            <span>
              <span>{round.title}</span>
              {round.category && (
                <span className="ml-2 text-cyan">{round.category}</span>
              )}
              {round.author && (
                <span className="block text-display-base font-bold text-foreground/60">
                  by {round.author}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
