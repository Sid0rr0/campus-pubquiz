'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  AckResult,
  JokerPickPlayersView,
  TeamJoker,
} from '@campus-pubquiz/types';
import { SavedConfirmation } from '@/app/play/saved-confirmation';
import { formatSecondsLeft, useSecondsLeft } from '@/app/lib/use-seconds-left';

const SAVED_VISIBLE_MS = 1500;

interface JokerPickScreenProps {
  jokerPick: JokerPickPlayersView;
  /** Whether the pick is still open for choosing; false once it has closed. */
  isOpen: boolean;
  /** The team's own joker as the server last said it. */
  myJoker: TeamJoker | null;
  onPick: (roundId: number) => Promise<AckResult>;
}

/**
 * The phone while the joker pick is on air: a card per round to tap (changing
 * the pick as often as the team likes until the deadline), the server's
 * countdown and a "Saved ✓" after each accepted tap. Once the pick has closed
 * it tells the team which round its joker is and sends it to the big screen.
 */
export function JokerPickScreen({
  jokerPick,
  isOpen,
  myJoker,
  onPick,
}: JokerPickScreenProps) {
  const secondsLeft = useSecondsLeft(isOpen ? jokerPick.endsAt : null);
  const [isSaved, setIsSaved] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  async function pick(roundId: number) {
    const result = await onPick(roundId);
    if (!result.success) {
      setRefusal(result.error);
      return;
    }
    setRefusal(null);
    setIsSaved(true);
    if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(
      () => setIsSaved(false),
      SAVED_VISIBLE_MS,
    );
  }

  if (!isOpen) {
    const round = jokerPick.rounds.find(
      (candidate) => candidate.roundId === myJoker?.roundId,
    );
    return (
      <div className="mt-16 flex flex-col items-center gap-3 text-center">
        <h1 className="font-display text-2xl text-magenta">
          {round
            ? `Your joker: Round ${round.roundNumber} — ${round.title}`
            : 'Your joker is set'}
        </h1>
        {myJoker?.source === 'drawn' && (
          <p className="text-sm text-foreground/65">
            No pick, so it was drawn for you.
          </p>
        )}
        <p className="text-sm font-extrabold tracking-wide text-foreground/55">
          👀 Look at the screen
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl">Pick your joker</h1>
        {secondsLeft !== null && (
          <p
            role="timer"
            aria-label="Time left to pick a joker"
            className="font-display text-xl text-cyan"
          >
            {formatSecondsLeft(secondsLeft)}
          </p>
        )}
      </div>
      <p className="text-sm text-foreground/65">
        Your points from the round you pick count double. Tap a round; you can
        change it until time is up.
      </p>
      <ul className="flex flex-col gap-3">
        {jokerPick.rounds.map((round) => {
          const isPicked = myJoker?.roundId === round.roundId;
          return (
            <li key={round.roundId}>
              <button
                type="button"
                aria-pressed={isPicked}
                onClick={() => void pick(round.roundId)}
                className={`flex w-full flex-col items-start gap-1 rounded-xl border-2 px-4 py-3 text-left ${
                  isPicked
                    ? 'border-magenta bg-magenta/15'
                    : 'border-foreground/20'
                }`}
              >
                <span className="text-xs font-extrabold tracking-wide text-foreground/55">
                  ROUND {round.roundNumber}
                </span>
                <span className="font-display text-xl">{round.title}</span>
                {round.category && (
                  <span className="text-sm text-cyan">{round.category}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {refusal && (
        <p role="alert" className="font-extrabold text-magenta">
          {refusal}
        </p>
      )}
      <SavedConfirmation isVisible={isSaved} />
    </div>
  );
}
