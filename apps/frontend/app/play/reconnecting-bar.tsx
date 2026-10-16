'use client';

import { useEffect, useState } from 'react';
import { RECONNECTING_MESSAGE } from '@/app/lib/connection-messages';

/** How long a phone may stay disconnected before the bar offers a manual reconnect. */
export const RECONNECT_HELP_DELAY_MS = 10_000;

interface ReconnectingBarProps {
  onReconnect: () => void;
}

/**
 * The full-width bar fixed to the top of /play while the phone isn't
 * connected. Render it only while disconnected: mounting starts the wait for
 * the "Tap to reconnect" button, unmounting (on reconnect) resets it.
 */
export function ReconnectingBar({ onReconnect }: ReconnectingBarProps) {
  const [isHelpShown, setIsHelpShown] = useState(false);

  useEffect(() => {
    const timer = setTimeout(
      () => setIsHelpShown(true),
      RECONNECT_HELP_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-magenta px-4 py-2 text-sm font-extrabold text-white"
    >
      <span>{RECONNECTING_MESSAGE}</span>
      {isHelpShown && (
        <button
          type="button"
          onClick={onReconnect}
          className="rounded-lg border-2 border-white px-3 py-1 font-extrabold"
        >
          Tap to reconnect
        </button>
      )}
    </div>
  );
}
