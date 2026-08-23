'use client';

import { useState, type FormEvent } from 'react';
import { CheckIcon, QuestionMarkCircledIcon } from '@radix-ui/react-icons';
import { IDK_ANSWER_VALUE, type QuestionView } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { getOptionLetter } from '@/app/lib/option-letters';
import { MatchAnswer } from '@/app/play/match-answer';
import { SortAnswer } from '@/app/play/sort-answer';

interface AnswerFormProps {
  question: QuestionView;
  initialValue?: string;
  onSubmit: (value: string) => void;
}

interface IdkButtonProps {
  isChosen: boolean;
  onClick: () => void;
}

/** Submits the IDK_ANSWER_VALUE sentinel — shown under every question type's answer input so a team can register "we don't know" instead of leaving the question untouched. */
function IdkButton({ isChosen, onClick }: IdkButtonProps) {
  return (
    <Button
      type="button"
      aria-pressed={isChosen}
      onClick={onClick}
      className={
        isChosen
          ? 'flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-magenta bg-white px-4 text-base font-extrabold text-magenta'
          : 'flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-foreground/35 bg-transparent px-4 text-base font-extrabold text-foreground/55'
      }
    >
      <QuestionMarkCircledIcon aria-hidden="true" />I don&apos;t know
      {isChosen && (
        <CheckIcon aria-hidden="true" className="ml-auto text-magenta" />
      )}
    </Button>
  );
}

export function AnswerForm({
  question,
  initialValue = '',
  onSubmit,
}: AnswerFormProps) {
  const [value, setValue] = useState(initialValue);
  const isIdk = initialValue === IDK_ANSWER_VALUE;
  const idkButton = (
    <IdkButton isChosen={isIdk} onClick={() => onSubmit(IDK_ANSWER_VALUE)} />
  );

  if (question.type === 'sort' && question.options) {
    return (
      <div className="flex flex-col gap-3">
        <SortAnswer
          options={question.options}
          initialValue={initialValue}
          onSubmit={onSubmit}
        />
        {idkButton}
      </div>
    );
  }

  if (question.type === 'match' && question.options && question.matchTargets) {
    return (
      <div className="flex flex-col gap-3">
        <MatchAnswer
          leftItems={question.options}
          rightItems={question.matchTargets}
          initialValue={initialValue}
          onSubmit={onSubmit}
        />
        {idkButton}
      </div>
    );
  }

  if (question.type === 'multiple_choice' && question.options) {
    return (
      <div className="flex flex-col gap-2.5">
        {question.options.map((option, index) => {
          const isChosen = option === initialValue;
          return (
            <Button
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
                <CheckIcon
                  aria-hidden="true"
                  className="ml-auto text-magenta"
                />
              )}
            </Button>
          );
        })}
        {idkButton}
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
      <label
        htmlFor="answer-value"
        className="text-xs font-extrabold tracking-wide text-foreground/55"
      >
        Your answer
      </label>
      <input
        id="answer-value"
        type={question.type === 'closest_guess' ? 'number' : 'text'}
        inputMode={question.type === 'closest_guess' ? 'decimal' : undefined}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold"
      />
      {initialValue && !isIdk && (
        <p className="text-xs font-extrabold tracking-wide text-foreground/55">
          Submitted: {initialValue}
        </p>
      )}
      <Button
        type="submit"
        variant="solid"
        className="flex min-h-14 items-center justify-center gap-2 rounded-2xl text-lg"
      >
        <CheckIcon aria-hidden="true" />
        Submit
      </Button>
      {idkButton}
    </form>
  );
}
