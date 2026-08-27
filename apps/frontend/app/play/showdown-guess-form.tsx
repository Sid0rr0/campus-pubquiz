'use client';

import { useState, type SubmitEvent } from 'react';
import { CheckIcon } from '@radix-ui/react-icons';
import { Button } from '@/app/components/button';

interface ShowdownGuessFormProps {
  question: string;
  initialValue?: string;
  onSubmit: (value: string) => void;
}

/** Numeric-guess form for the showdown tiebreaker — modeled on AnswerForm's closest_guess branch, single submit, no IDK option (every participant is expected to guess). */
export function ShowdownGuessForm({
  question,
  initialValue = '',
  onSubmit,
}: ShowdownGuessFormProps) {
  const [value, setValue] = useState(initialValue);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim()) return;
    onSubmit(value.trim());
  }

  return (
    <div className="mt-16 flex flex-col items-center gap-4 text-center">
      <p className="text-sm font-extrabold tracking-wide text-foreground/55">
        SHOWDOWN TIEBREAKER
      </p>
      <h1 className="text-balance font-display text-2xl">{question}</h1>
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
    </div>
  );
}
