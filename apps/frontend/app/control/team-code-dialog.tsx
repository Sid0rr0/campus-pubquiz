'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Dialog } from 'radix-ui';
import { Button } from '@/app/components/button';
import { CopyButton } from '@/app/components/copy-button';

const QR_SIZE_PX = 180;

interface TeamCodeDialogProps {
  /** false closes the dialog. */
  open: boolean;
  teamName: string;
  /** null while the code is still loading. */
  code: string | null;
  /** The live session's join code, when known — folded into the QR value so scanning it prefills both fields on /play, not just the team code. */
  joinCode?: string | null;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
}

/** Shows one team's persistent join code — the credential a team re-enters to play as itself in a future session. */
export function TeamCodeDialog({
  open,
  teamName,
  code,
  joinCode,
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
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xl font-extrabold tracking-widest">
                  {code}
                </span>
                <CopyButton value={code} />
              </div>
              <div className="rounded-xl border-2 border-background/20 bg-white p-3">
                <QRCodeSVG
                  value={`${window.location.origin}/play?teamCode=${code}&name=${encodeURIComponent(teamName)}${joinCode ? `&code=${joinCode}` : ''}`}
                  title="Team code QR code"
                  size={QR_SIZE_PX}
                />
              </div>
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
