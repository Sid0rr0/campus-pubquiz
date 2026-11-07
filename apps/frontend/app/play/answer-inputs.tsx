'use client';

import { useState, type ReactNode, type SubmitEvent } from 'react';
import { CheckIcon } from '@radix-ui/react-icons';
import {
  IDK_ANSWER_VALUE,
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
  /** Active round's quickfire speed scoring flag: a tapped choice submits immediately and locks. */
  isQuickfireMode: boolean;
  onSubmit: (value: string) => void;
  /** A pin the team bought on this sort or match question. */
  pin?: PinEffect;
  /** Options a 50/50 removed from this multiple-choice question: greyed out, not selectable. */
  removedOptions?: string[];
  /** The "I don't know" button, placed by each input where it belongs in its own layout. */
  idkButton: ReactNode;
}

const NO_ITEMS: string[] = [];

function TypedInput({
  inputType,
  initialValue,
  onSubmit,
  idkButton,
}: Pick<AnswerInputProps, 'initialValue' | 'onSubmit' | 'idkButton'> & {
  inputType: 'text' | 'number';
}) {
  // "I don't know" is stored as a sentinel; the box starts empty rather than showing it.
  const [value, setValue] = useState(
    initialValue === IDK_ANSWER_VALUE ? '' : initialValue,
  );

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim()) return;
    onSubmit(value.trim());
  }

  const isSubmitted = value.trim() !== '' && value.trim() === initialValue;

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

/** How many options before `index` have the same text. */
function occurrenceOf(options: readonly string[], index: number): number {
  return options.slice(0, index).filter((other) => other === options[index])
    .length;
}

function ChoiceOption({
  option,
  index,
  isChosen,
  isRemoved,
  isLocked,
  onClick,
}: {
  option: string;
  index: number;
  isChosen: boolean;
  isRemoved: boolean;
  isLocked: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      aria-pressed={isChosen}
      disabled={isRemoved || isLocked}
      onClick={onClick}
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
}

function ChoiceInput({
  question,
  initialValue,
  isQuickfireMode,
  onSubmit,
  removedOptions = NO_ITEMS,
  idkButton,
}: AnswerInputProps) {
  const [value, setValue] = useState(initialValue);
  const [hasAnswered, setHasAnswered] = useState(initialValue !== '');
  const isSubmitted = value !== '' && value === initialValue;

  function handleOptionClick(option: string) {
    if (isQuickfireMode) {
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
      {(question.options ?? NO_ITEMS).map((option, index, options) => (
        <ChoiceOption
          // Nothing forbids two options with the same text, so the text alone can't be the key.
          key={`${option}#${occurrenceOf(options, index)}`}
          option={option}
          index={index}
          isChosen={option === value}
          isRemoved={removedOptions.includes(option)}
          isLocked={isQuickfireMode && hasAnswered}
          onClick={() => handleOptionClick(option)}
        />
      ))}
      {!isQuickfireMode && (
        <SubmitAnswerButton
          isSubmitted={isSubmitted}
          disabled={value === ''}
          onClick={() => onSubmit(value)}
        />
      )}
      {!isQuickfireMode && idkButton}
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
