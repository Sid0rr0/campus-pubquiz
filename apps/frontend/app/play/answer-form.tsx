'use client';

import { CheckIcon, QuestionMarkCircledIcon } from '@radix-ui/react-icons';
import {
  IDK_ANSWER_VALUE,
  resolveAnswerKind,
  type QuestionView,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { ANSWER_INPUTS } from '@/app/play/answer-inputs';

interface AnswerFormProps {
  question: QuestionView;
  initialValue?: string;
  /** Active round's Kahoot-style speed scoring flag — for multiple_choice, tap submits immediately and locks the pick, with no Submit or "I don't know" button. */
  isKahootMode?: boolean;
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
  isKahootMode = false,
  onSubmit,
}: AnswerFormProps) {
  const AnswerInput = ANSWER_INPUTS[resolveAnswerKind(question)];
  const isIdk = initialValue === IDK_ANSWER_VALUE;

  return (
    <AnswerInput
      question={question}
      initialValue={initialValue}
      isKahootMode={isKahootMode}
      onSubmit={onSubmit}
      idkButton={
        <IdkButton
          isChosen={isIdk}
          onClick={() => onSubmit(isIdk ? '' : IDK_ANSWER_VALUE)}
        />
      }
    />
  );
}
