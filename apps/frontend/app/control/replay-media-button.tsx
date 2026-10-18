'use client';

import { ReloadIcon } from '@radix-ui/react-icons';
import type { GameAction } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';

interface ReplayMediaButtonProps {
  /** Whether the currently open question has a video (YouTube or file) showing on /display — see isVideoUrl. Renders nothing otherwise, since there'd be nothing for REPLAY_MEDIA to act on. */
  canReplay: boolean;
  onAction: (action: GameAction) => void;
  className?: string;
}

/** Restarts the current question's YouTube video from the beginning on /display (dispatches REPLAY_MEDIA) — for /control and /remote, the two places the admin watches playback without being able to scrub the embed themselves. */
export function ReplayMediaButton({
  canReplay,
  onAction,
  className = '',
}: ReplayMediaButtonProps) {
  if (!canReplay) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      aria-label="Play video again"
      onClick={() => onAction('REPLAY_MEDIA')}
      className={`flex-1 ${className}`}
    >
      <ReloadIcon aria-hidden="true" />
      Play again
    </Button>
  );
}
