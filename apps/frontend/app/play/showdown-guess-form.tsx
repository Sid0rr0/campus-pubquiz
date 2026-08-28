'use client';

import { useState, type SubmitEvent } from 'react';
import { CheckIcon } from '@radix-ui/react-icons';
import { Button } from '@/app/components/button';

interface ShowdownGuessFormProps {
  question: string;
  /** True once the server has recorded this team's guess (e.g. after a reconnect) — shows the submitted state without a remembered value. */
  hasGuessed: boolean;
  onSubmit: (value: string) => void;
}

/** Numeric-guess form for the showdown tiebreaker — modeled on AnswerForm's closest_guess branch, single submit, no IDK option (every participant is expected to guess). Once submitted, shows the team's own guess below the question instead of the form — the server doesn't echo it back (guesses stay hidden from other teams until reveal), so the submitted value is remembered locally. */
export function ShowdownGuessForm({
  question,
  hasGuessed,
  onSubmit,
}: ShowdownGuessFormProps) {
  const [value, setValue] = useState('');
  const [submittedGuess, setSubmittedGuess] = useState<string | null>(null);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setSubmittedGuess(trimmed);
    onSubmit(trimmed);
  }

  const isSubmitted = hasGuessed || submittedGuess !== null;

  return (
    <div className="mt-16 flex flex-col items-center gap-4 text-center">
      <p className="text-sm font-extrabold tracking-wide text-foreground/55">
        SHOWDOWN TIEBREAKER
      </p>
      <h1 className="text-balance font-display text-2xl">{question}</h1>
      {isSubmitted ? (
        <div className="flex flex-col items-center gap-1">
          {submittedGuess !== null && (
            <p className="text-lg font-bold">
              Your guess:{' '}
              <span className="text-magenta">{submittedGuess}</span>
            </p>
          )}
          <p className="text-sm font-extrabold text-foreground/55">
            Waiting for other teams…
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-xs flex-col gap-2"
        >
          <label
            htmlFor="showdown-guess-value"
            className="text-xs font-extrabold tracking-wide text-foreground/55"
          >
            Your guess
          </label>
          <input
            id="showdown-guess-value"
            type="number"
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold"
          />
          <Button
            type="submit"
            variant="solid"
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl text-lg"
          >
            <CheckIcon aria-hidden="true" />
            Submit
          </Button>
        </form>
      )}
    </div>
  );
}
