'use client';

import { Dialog } from 'radix-ui';
import { Button } from '@/app/components/button';
import { CopyButton } from '@/app/components/copy-button';

interface TeamCodeDialogProps {
  /** false closes the dialog. */
  open: boolean;
  teamName: string;
  /** null while the code is still loading. */
  code: string | null;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
}

/** Shows one team's persistent join code — the credential a team re-enters to play as itself in a future session. */
export function TeamCodeDialog({
  open,
  teamName,
  code,
  error,
  onOpenChange,
}: TeamCodeDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-40 flex w-full max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl bg-foreground p-5 text-background">
          <Dialog.Title className="font-display text-lg">
            Team code — {teamName}
          </Dialog.Title>
          {error && (
            <p role="alert" className="text-sm font-bold text-magenta">
              {error}
            </p>
          )}
          {!error && code === null && (
            <p className="text-sm text-background/60">Loading…</p>
          )}
          {!error && code !== null && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-extrabold tracking-widest">
                {code}
              </span>
              <CopyButton value={code} />
            </div>
          )}
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="self-end rounded-lg px-3 py-1.5 text-sm font-bold text-background/70"
          >
            Close
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
