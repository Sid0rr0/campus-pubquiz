'use client';

import type { ReactNode } from 'react';
import { AlertDialog } from 'radix-ui';
import { Button } from '@/app/components/button';

interface ConfirmDialogProps {
  /** The element that opens the dialog — rendered via `asChild`, so it must accept a ref and forward its props (e.g. a `Button`). */
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

/** A destructive/irreversible action gated behind an "are you sure?" dialog — shared by Close Session, End Quiz, and Kick team. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-30 bg-black/50" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-40 flex w-full max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl border bg-foreground p-5 text-background">
          <AlertDialog.Title className="font-display text-lg">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm font-bold text-background/70">
            {description}
          </AlertDialog.Description>
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button
                type="button"
                size="sm"
                className="rounded-lg font-bold text-background/70"
              >
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                type="button"
                variant="solid-flat"
                size="sm"
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
