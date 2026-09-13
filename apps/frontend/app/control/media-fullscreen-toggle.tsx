'use client';

import { EnterFullScreenIcon, ExitFullScreenIcon } from '@radix-ui/react-icons';
import type { GameAction } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';

interface MediaFullscreenToggleProps {
  isMediaFullscreen: boolean;
  onAction: (action: GameAction) => void;
  /**
   * 'dark' for placement on a dark (bg-foreground) surface — e.g. AdminActions
   * inside the control sidebar/drawer — where the default 'icon' variant's
   * border color (border-foreground/20) is invisible against that background.
   */
  tone?: 'light' | 'dark';
  className?: string;
}

/**
 * Tappable equivalent of the spacebar shortcut (see useAdminKeyboardShortcuts)
 * for full-viewport question media on /display — /remote and touch-only
 * admin devices have no keyboard to trigger it from. No-op on /display when
 * the current question has no media to enlarge.
 */
export function MediaFullscreenToggle({
  isMediaFullscreen,
  onAction,
  tone = 'light',
  className = '',
}: MediaFullscreenToggleProps) {
  return (
    <Button
      type="button"
      variant={tone === 'dark' ? undefined : 'icon'}
      aria-label={
        isMediaFullscreen ? 'Exit fullscreen media' : 'Fullscreen media'
      }
      aria-pressed={isMediaFullscreen}
      onClick={() => onAction('TOGGLE_MEDIA_FULLSCREEN')}
      className={[
        // Matches size="lg"'s min-h-11 (the Previous/Advance/Leaderboard
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
      {isMediaFullscreen ? (
        <ExitFullScreenIcon aria-hidden="true" />
      ) : (
        <EnterFullScreenIcon aria-hidden="true" />
      )}
    </Button>
  );
}
