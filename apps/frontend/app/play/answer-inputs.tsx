'use client';

import { useState, type ReactNode, type SubmitEvent } from 'react';
import { CheckIcon } from '@radix-ui/react-icons';
import {
  type AnswerKind,
  type PinEffect,
  type QuestionView,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { getOptionLetter } from '@/app/lib/option-letters';
import { MatchAnswer } from '@/app/play/match-answer';
import { SortAnswer } from '@/app/play/sort-answer';
import { SubmitAnswerButton } from '@/app/play/submit-answer-button';

export interface AnswerInputProps {
  question: QuestionView;
  initialValue: string;
  /** Active round's Kahoot-style speed scoring flag: a tapped choice submits immediately and locks. */
  isKahootMode: boolean;
  onSubmit: (value: string) => void;
  /** A pin the team bought on this sort or match question. */
  pin?: PinEffect;
  /** Options a 50/50 removed from this multiple-choice question: greyed out, not selectable. */
  removedOptions?: string[];
  /** The answer already given counts as submitted only once sent again. */
  mustResubmit?: boolean;
  /** The "I don't know" button, placed by each input where it belongs in its own layout. */
  idkButton: ReactNode;
}

const NO_ITEMS: string[] = [];

function TypedInput({
  inputType,
  initialValue,
  mustResubmit = false,
  onSubmit,
  idkButton,
}: Pick<
  AnswerInputProps,
  'initialValue' | 'mustResubmit' | 'onSubmit' | 'idkButton'
> & {
  inputType: 'text' | 'number';
}) {
  const [value, setValue] = useState(initialValue);
  const [isResent, setIsResent] = useState(false);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim()) return;
    setIsResent(true);
    onSubmit(value.trim());
  }

  const isSubmitted =
    value.trim() !== '' &&
    value.trim() === initialValue &&
    (!mustResubmit || isResent);

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
        type={inputType}
        inputMode={inputType === 'number' ? 'decimal' : undefined}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold"
      />
      <SubmitAnswerButton type="submit" isSubmitted={isSubmitted} />
      {idkButton}
    </form>
  );
}

function TextInput(props: AnswerInputProps) {
  return <TypedInput inputType="text" {...props} />;
}

function NumberInput(props: AnswerInputProps) {
  return <TypedInput inputType="number" {...props} />;
}

function ChoiceInput({
  question,
  initialValue,
  isKahootMode,
  onSubmit,
  removedOptions = NO_ITEMS,
  idkButton,
}: AnswerInputProps) {
  const [value, setValue] = useState(initialValue);
  const [hasAnswered, setHasAnswered] = useState(initialValue !== '');
  const isSubmitted = value !== '' && value === initialValue;

  function handleOptionClick(option: string) {
    if (isKahootMode) {
      if (hasAnswered) return;
      setHasAnswered(true);
      setValue(option);
      onSubmit(option);
      return;
    }
    setValue(option);
  }

  return (
    <div className="flex flex-col gap-2.5">
      {(question.options ?? NO_ITEMS).map((option, index, options) => {
        const isChosen = option === value;
        const isRemoved = removedOptions.includes(option);
        // Nothing forbids two options with the same text, so the text alone can't be the key.
        const occurrence = options
          .slice(0, index)
          .filter((other) => other === option).length;
        return (
          <Button
            key={`${option}#${occurrence}`}
            type="button"
            aria-pressed={isChosen}
            disabled={isRemoved || (isKahootMode && hasAnswered)}
            onClick={() => handleOptionClick(option)}
            className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 min-w-2xs bg-white px-4 text-lg font-bold ${
              isChosen ? 'border-dark-blue' : 'border-foreground/30'
            } ${isRemoved ? 'opacity-40' : ''}`}
          >
            <span aria-hidden="true" className="font-display text-cyan">
              {getOptionLetter(index)}
            </span>
            {option}
            {isChosen && (
              <CheckIcon aria-hidden="true" className="ml-auto text-magenta" />
            )}
          </Button>
        );
      })}
      {!isKahootMode && (
        <SubmitAnswerButton
          isSubmitted={isSubmitted}
          disabled={value === ''}
          onClick={() => onSubmit(value)}
        />
      )}
      {!isKahootMode && idkButton}
    </div>
  );
}

function SortInput({
  question,
  initialValue,
  pin,
  onSubmit,
  idkButton,
}: AnswerInputProps) {
  return (
    <div className="flex flex-col gap-3">
      <SortAnswer
        options={question.options ?? NO_ITEMS}
        initialValue={initialValue}
        pin={pin}
        onSubmit={onSubmit}
      />
      {idkButton}
    </div>
  );
}

function MatchInput({
  question,
  initialValue,
  pin,
  onSubmit,
  idkButton,
}: AnswerInputProps) {
  return (
    <div className="flex flex-col gap-3">
      <MatchAnswer
        leftItems={question.options ?? NO_ITEMS}
        rightItems={question.matchTargets ?? NO_ITEMS}
        initialValue={initialValue}
        pin={pin}
        onSubmit={onSubmit}
      />
      {idkButton}
    </div>
  );
}

/** The phone's answer input for each answer kind; a kind without an entry is a compile error. */
export const ANSWER_INPUTS = {
  text: TextInput,
  number: NumberInput,
  choice: ChoiceInput,
  sort: SortInput,
  match: MatchInput,
} satisfies Record<AnswerKind, (props: AnswerInputProps) => ReactNode>;
