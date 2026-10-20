'use client';

import { PauseIcon, PlayIcon } from '@radix-ui/react-icons';
import type { GameAction } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { ADMIN_SHORTCUTS } from '@/app/control/admin-keyboard-shortcuts';

interface MediaPauseButtonProps {
  /** Whether the open question has YouTube or audio media on /display to pause — see isPausableMediaUrl. Renders nothing otherwise. */
  canPause: boolean;
  /** GameProgress.isMediaPaused — flips the label between Pause and Resume. */
  isPaused: boolean;
  onAction: (action: GameAction) => void;
  className?: string;
}

/** Pauses or resumes the current question's YouTube/audio playback on /display (dispatches TOGGLE_MEDIA_PAUSE). */
export function MediaPauseButton({
  canPause,
  isPaused,
  onAction,
  className = '',
}: MediaPauseButtonProps) {
  if (!canPause) return null;

  const label = isPaused ? 'Resume' : 'Pause';
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      aria-label={label}
      title={`Pause or resume (${ADMIN_SHORTCUTS.toggleMediaPause.keyName})`}
      onClick={() => onAction('TOGGLE_MEDIA_PAUSE')}
      className={`flex-1 ${className}`}
    >
      {isPaused ? (
        <PlayIcon aria-hidden="true" />
      ) : (
        <PauseIcon aria-hidden="true" />
      )}
      {label}
    </Button>
  );
}
