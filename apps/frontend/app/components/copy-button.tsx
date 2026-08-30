'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon } from '@radix-ui/react-icons';
import { Button } from '@/app/components/button';
import { toast } from 'sonner';

const COPIED_FEEDBACK_MS = 1500;

interface CopyButtonProps {
  value: string;
  text?: boolean;
  label?: string;
  className?: string;
}

/** Copies `value` to the clipboard and shows brief "copied" feedback — used everywhere a join/team code is displayed for someone to relay or re-enter. */
export function CopyButton({
  value,
  text = false,
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
      toast.error('Could not copy code to clipboard');
    }
  }

  return (
    <Button
      type="button"
      onClick={() => void handleClick()}
      aria-label={isCopied ? 'Copied' : label}
      className={`inline-flex items-center gap-1 ${className} ${text && 'px-2 py-1'}`}
      variant={text ? 'outline' : 'icon'}
    >
      {isCopied ? (
        <div className="flex items-center gap-1">
          <CheckIcon aria-hidden="true" /> Copied
        </div>
      ) : (
        <>
          <CopyIcon aria-hidden="true" /> {text && 'Copy code'}
        </>
      )}
    </Button>
  );
}
