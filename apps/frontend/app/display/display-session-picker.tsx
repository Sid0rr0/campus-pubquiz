'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActiveSessionSummary } from '@campus-pubquiz/types';
import { fetchPublicSessions, SessionApiError } from '@/app/lib/sessions-api';

interface DisplaySessionPickerProps {
  onSelectSession: (joinCode: string) => void;
  /** Surfaced when a code from the URL/QR turned out to be unknown or closed, so the operator knows why they landed here. */
  connectionError?: string | null;
}

/**
 * Landing screen for /display when no `?code=` is pinned (or the pinned one
 * no longer resolves) — venue TV/projector hardware has no admin login of
 * its own, so this lists every running session via the unauthenticated
 * `/sessions/public` endpoint instead of gating on SessionGuard like the
 * admin picker does.
 */
export function DisplaySessionPicker({ onSelectSession, connectionError }: DisplaySessionPickerProps) {
  const [sessions, setSessions] = useState<ActiveSessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Guards state updates from a refresh that resolves after this picker has
  // unmounted (e.g. the operator picks a session before the fetch settles).
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    fetchPublicSessions()
      .then((result) => {
        if (!isMountedRef.current) return;
        setSessions(result);
        setError(null);
      })
      .catch((fetchError: unknown) => {
        if (!isMountedRef.current) return;
        setError(fetchError instanceof SessionApiError ? fetchError.message : 'Could not load sessions');
      })
      .finally(() => {
        if (isMountedRef.current) setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleRefreshClick() {
    setIsLoading(true);
    refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-16 py-10 text-foreground">
      <h1 className="font-display text-3xl">Pick a game to display</h1>
      {connectionError && (
        <p role="alert" className="text-center font-extrabold text-magenta">
          {connectionError}
        </p>
      )}
      {error && (
        <p role="alert" className="text-center font-extrabold text-magenta">
          {error}
        </p>
      )}
      {!isLoading && sessions.length === 0 && !error && (
        <p className="text-foreground/55">No games running yet — start one from the admin console.</p>
      )}
      <ul className="flex w-full max-w-xl flex-col gap-3">
        {sessions.map((session) => (
          <li key={session.joinCode}>
            <button
              type="button"
              onClick={() => onSelectSession(session.joinCode)}
              className="flex min-h-16 w-full items-center justify-between rounded-2xl border-2 border-foreground/15 bg-white px-5 text-left"
            >
              <span className="flex flex-col">
                <span className="font-extrabold">{session.quizTitle}</span>
                <span className="text-xs text-foreground/55">
                  {session.status} · {session.teamCount} teams · {session.joinCode}
                </span>
              </span>
              <span className="font-display text-lg text-magenta">Watch →</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={handleRefreshClick}
        disabled={isLoading}
        className="text-sm font-extrabold text-foreground/55 underline disabled:opacity-40"
      >
        {isLoading ? 'Refreshing…' : 'Refresh'}
      </button>
    </main>
  );
}
