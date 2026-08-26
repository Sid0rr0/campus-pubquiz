'use client';

import { Dialog } from 'radix-ui';
import { Button } from '@/app/components/button';

interface SettingsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  autoAdvanceEnabled: boolean;
  onAutoAdvanceChange: (enabled: boolean) => void;
}

/** Player-only preferences, opened from the team menu (mobile drawer + desktop button). */
export function SettingsModal({
  isOpen,
  onOpenChange,
  autoAdvanceEnabled,
  onAutoAdvanceChange,
}: SettingsModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-40 flex w-full max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl bg-foreground p-5 text-background">
          <Dialog.Title className="font-display text-lg">
            Settings
          </Dialog.Title>
          <label className="flex items-center gap-2 text-sm font-extrabold">
            <input
              type="checkbox"
              checked={autoAdvanceEnabled}
              onChange={(event) => onAutoAdvanceChange(event.target.checked)}
            />
            Auto-advance to new question
          </label>
          <p className="text-xs text-background/60">
            {autoAdvanceEnabled
              ? 'Your screen follows the big screen automatically.'
              : 'Your screen stays put until you tap Next — use the Prev/Next buttons to move between questions the quiz master has already opened.'}
          </p>
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
