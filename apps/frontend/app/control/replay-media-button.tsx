'use client';

import { ReloadIcon } from '@radix-ui/react-icons';
import type { GameAction } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';

interface ReplayMediaButtonProps {
  /** Whether the currently open question has a YouTube video showing on /display — see isYoutubeMediaUrl. Renders nothing otherwise, since there'd be nothing for REPLAY_MEDIA to act on. */
  canReplay: boolean;
  onAction: (action: GameAction) => void;
  /**
   * 'dark' for placement on a dark (bg-foreground) surface — e.g. AdminActions
   * inside the control sidebar/drawer — where the default 'icon' variant's
   * border color (border-foreground/20) is invisible against that background.
   */
  tone?: 'light' | 'dark';
  className?: string;
}

/** Restarts the current question's YouTube video from the beginning on /display (dispatches REPLAY_MEDIA) — for /control and /remote, the two places the admin watches playback without being able to scrub the embed themselves. */
export function ReplayMediaButton({
  canReplay,
  onAction,
  tone = 'light',
  className = '',
}: ReplayMediaButtonProps) {
  if (!canReplay) return null;

  return (
    <Button
      type="button"
      variant={tone === 'dark' ? undefined : 'icon'}
      aria-label="Play video again"
      onClick={() => onAction('REPLAY_MEDIA')}
      className={[
        // Matches size="lg"'s min-h-11 (the Previous/Advance/Open Leaderboard
        // buttons this sits beside) — the icon-lg size preset is h-9, shorter.
        'flex h-11 w-11 shrink-0 items-center justify-center',
        tone === 'dark'
          ? 'rounded-lg border-2 border-background/20 font-extrabold text-background disabled:opacity-30'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <ReloadIcon aria-hidden="true" />
    </Button>
  );
}
