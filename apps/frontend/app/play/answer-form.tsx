'use client';

import { useState, type FormEvent } from 'react';
import type { QuestionView } from '@campus-pubquiz/types';
import { getOptionLetter } from '@/app/lib/option-letters';

interface AnswerFormProps {
  question: QuestionView;
  initialValue?: string;
  onSubmit: (value: string) => void;
}

export function AnswerForm({ question, initialValue = '', onSubmit }: AnswerFormProps) {
  const [value, setValue] = useState(initialValue);

  if (question.type === 'multiple_choice' && question.options) {
    return (
      <div className="flex flex-col gap-2.5">
        {question.options.map((option, index) => {
          const isChosen = option === initialValue;
          return (
            <button
              key={index}
              type="button"
              aria-pressed={isChosen}
              onClick={() => onSubmit(option)}
              className={
                isChosen
                  ? 'flex min-h-14 items-center gap-3 rounded-2xl border-2 border-magenta bg-white px-4 text-lg font-bold'
                  : 'flex min-h-14 items-center gap-3 rounded-2xl border-2 border-foreground/30 bg-white px-4 text-lg font-bold'
              }
            >
              <span aria-hidden="true" className="font-display text-cyan">
                {getOptionLetter(index)}
              </span>
              {option}
              {isChosen && (
                <span aria-hidden="true" className="ml-auto font-display text-magenta">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim()) return;
    onSubmit(value.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="answer-value" className="text-xs font-extrabold tracking-wide text-foreground/55">
        Your answer
      </label>
      <input
        id="answer-value"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold"
      />
      <button
        type="submit"
        className="min-h-14 rounded-2xl bg-magenta font-display text-lg text-white shadow-[0_3px_0_#b8006d]"
      >
        Submit
      </button>
    </form>
  );
}
