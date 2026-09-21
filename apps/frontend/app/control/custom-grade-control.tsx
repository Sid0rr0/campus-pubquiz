'use client';

import { useState } from 'react';
import { Button } from '@/app/components/button';

interface CustomGradeControlProps {
  teamName: string;
  /** Points currently awarded (0 when ungraded) — where the input starts, and what "changed" is measured against. */
  currentAmount: number;
  /** The answer is graded with an amount that none of the 0/half/full buttons represent, so this button carries the checkmark. */
  isSelected: boolean;
  isDisabled: boolean;
  onConfirm: (amount: number) => void;
}

function parseAmount(draft: string): number | null {
  if (draft.trim() === '') {
    return null;
  }
  const amount = Number(draft);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/**
 * The "Custom" quick-grade button. Clicking it reveals an amount input next to
 * it; once the amount differs from what's already awarded the button becomes
 * "Confirm" and grades with that amount. Clicking it with nothing changed just
 * hides the input again.
 */
export function CustomGradeControl({
  teamName,
  currentAmount,
  isSelected,
  isDisabled,
  onConfirm,
}: CustomGradeControlProps) {
  // null = input hidden; a string (even '') = input shown with that draft.
  const [draft, setDraft] = useState<string | null>(null);
  const isOpen = draft !== null;
  const parsedAmount = isOpen ? parseAmount(draft) : null;
  const confirmableAmount =
    parsedAmount !== null && parsedAmount !== currentAmount
      ? parsedAmount
      : null;

  function confirm(amount: number) {
    onConfirm(amount);
    setDraft(null);
  }

  function handleButtonClick() {
    if (confirmableAmount !== null) {
      confirm(confirmableAmount);
      return;
    }
    setDraft(isOpen ? null : String(currentAmount));
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && confirmableAmount !== null) {
      confirm(confirmableAmount);
    } else if (event.key === 'Escape') {
      setDraft(null);
    }
  }

  const isConfirming = confirmableAmount !== null;
  const showsCheckmark = isSelected && !isOpen;
  const label = isConfirming
    ? 'Confirm'
    : showsCheckmark
      ? `✓ ${currentAmount}`
      : 'Custom';

  return (
    <>
      <Button
        type="button"
        disabled={isDisabled}
        variant={showsCheckmark || isConfirming ? undefined : 'outline-muted'}
        aria-label={`${isConfirming ? 'Confirm' : 'Grade'} ${teamName} custom points`}
        onClick={handleButtonClick}
        className={
          showsCheckmark || isConfirming
            ? 'flex h-9 items-center justify-center rounded-lg bg-green px-3 font-extrabold whitespace-nowrap text-white'
            : 'flex h-9 items-center justify-center px-3 whitespace-nowrap'
        }
      >
        {label}
      </Button>
      {isOpen && (
        <input
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleInputKeyDown}
          aria-label={`Custom points for ${teamName}`}
          className="h-9 w-20 rounded-lg border-2 border-foreground/30 bg-white px-2 text-center font-extrabold"
        />
      )}
    </>
  );
}
