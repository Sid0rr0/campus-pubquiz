'use client';

import { CheckIcon } from '@radix-ui/react-icons';
import { Button } from '@/app/components/button';

interface SubmitAnswerButtonProps {
  isSubmitted: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
}

/** Shared Submit button for every answer type on `/play` — solid magenta while the draft answer differs from what's already recorded for this question, turns green once they match, and reverts the moment the team's draft changes away from the recorded answer again. */
export function SubmitAnswerButton({
  isSubmitted,
  type = 'button',
  onClick,
  disabled,
}: SubmitAnswerButtonProps) {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={
        isSubmitted
          ? 'flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-green font-display text-lg text-white shadow-[0_3px_0_#5c9132] disabled:opacity-50'
          : 'flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-magenta font-display text-lg text-white shadow-[0_3px_0_#b8006d] disabled:opacity-50'
      }
    >
      <CheckIcon aria-hidden="true" />
      {isSubmitted ? 'Submitted' : 'Submit'}
    </Button>
  );
}
