'use client';

import { useEffect, useRef } from 'react';

/** How long the page must have been hidden before coming back counts as a wake worth a fresh connection — shorter hides keep the socket they have. */
export const HIDDEN_RECONNECT_THRESHOLD_MS = 5000;

/**
 * Calls `onWake` whenever a phone comes back: the tab turns visible after being
 * hidden for at least `HIDDEN_RECONNECT_THRESHOLD_MS`, the page is restored from
 * the back/forward cache, or the network returns. Mobile OSes freeze a
 * backgrounded socket, which can still look connected for tens of seconds.
 */
export function useReconnectOnWake(onWake: () => void): void {
  const onWakeRef = useRef(onWake);
  useEffect(() => {
    onWakeRef.current = onWake;
  }, [onWake]);

  useEffect(() => {
    let hiddenAt: number | null = null;

    const wake = () => onWakeRef.current();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      const wasHiddenFor = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (wasHiddenFor >= HIDDEN_RECONNECT_THRESHOLD_MS) wake();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) wake();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', wake);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', wake);
    };
  }, []);
}
