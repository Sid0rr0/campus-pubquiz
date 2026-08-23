'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon } from '@radix-ui/react-icons';
import { Button } from '@/app/components/button';

const COPIED_FEEDBACK_MS = 1500;

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
}

/** Copies `value` to the clipboard and shows brief "copied" feedback — used everywhere a join/team code is displayed for someone to relay or re-enter. */
export function CopyButton({
  value,
  label = 'Copy code',
  className = '',
}: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // Clipboard access can be denied (permissions, insecure context) — the
      // code is still visible on screen for the user to copy by hand.
    }
  }

  return (
    <Button
      type="button"
      onClick={() => void handleClick()}
      aria-label={isCopied ? 'Copied' : label}
      className={`inline-flex items-center gap-1 ${className}`}
    >
      {isCopied ? (
        <CheckIcon aria-hidden="true" />
      ) : (
        <CopyIcon aria-hidden="true" />
      )}
    </Button>
  );
}
