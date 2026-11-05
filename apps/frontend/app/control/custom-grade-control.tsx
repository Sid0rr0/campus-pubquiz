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
  const confirmableAmount = isOpen
    ? confirmableAmountOf(draft, currentAmount)
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
    if (event.key === 'Escape') setDraft(null);
    else if (event.key === 'Enter') handleEnter();
  }

  function handleEnter() {
    if (confirmableAmount !== null) confirm(confirmableAmount);
  }

  return (
    <>
      <CustomGradeButton
        teamName={teamName}
        currentAmount={currentAmount}
        isConfirming={confirmableAmount !== null}
        showsCheckmark={isSelected && !isOpen}
        isDisabled={isDisabled}
        onClick={handleButtonClick}
      />
      {isOpen && (
        <input
          type="number"
          min={0}
          step={0.5}
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

/** The typed amount, when it is a valid one that changes the grade. */
function confirmableAmountOf(
  draft: string,
  currentAmount: number,
): number | null {
  const parsedAmount = parseAmount(draft);
  return parsedAmount !== null && parsedAmount !== currentAmount
    ? parsedAmount
    : null;
}

function CustomGradeButton({
  teamName,
  currentAmount,
  isConfirming,
  showsCheckmark,
  isDisabled,
  onClick,
}: {
  teamName: string;
  currentAmount: number;
  isConfirming: boolean;
  showsCheckmark: boolean;
  isDisabled: boolean;
  onClick: () => void;
}) {
  const isHighlighted = showsCheckmark || isConfirming;
  const label = isConfirming
    ? 'Confirm'
    : showsCheckmark
      ? `✓ ${currentAmount}`
      : 'Custom';
  return (
    <Button
      type="button"
      disabled={isDisabled}
      variant={isHighlighted ? undefined : 'outline-muted'}
      aria-label={`${isConfirming ? 'Confirm' : 'Grade'} ${teamName} custom points`}
      onClick={onClick}
      className={
        isHighlighted
          ? 'flex h-9 items-center justify-center rounded-lg bg-green px-3 font-extrabold whitespace-nowrap text-white'
          : 'flex h-9 items-center justify-center px-3 whitespace-nowrap'
      }
    >
      {label}
    </Button>
  );
}
