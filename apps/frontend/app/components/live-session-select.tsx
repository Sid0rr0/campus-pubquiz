'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Select } from 'radix-ui';
import type { ActiveSessionSummary } from '@campus-pubquiz/types';
import { fetchPublicSessions, SessionApiError } from '@/app/lib/sessions-api';

interface LiveSessionSelectProps {
  value: string;
  onSelectSession: (joinCode: string) => void;
}

/**
 * Lets a joining team pick a running game from the unauthenticated
 * `/sessions/public` list (same endpoint `/display` uses) instead of typing
 * its join code by hand. Purely a convenience for the Game code field below
 * it — picking an option fills that field but doesn't otherwise gate typing
 * a code manually (e.g. one not yet reflected in this list).
 */
export function LiveSessionSelect({
  value,
  onSelectSession,
}: LiveSessionSelectProps) {
  const [sessions, setSessions] = useState<ActiveSessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Guards state updates from a fetch that resolves after this control has
  // unmounted (e.g. the team joins before the request settles). Reset to
  // true on setup, not just via the initializer — React 18 Strict Mode's
  // dev-only mount→cleanup→mount cycle otherwise leaves this pinned to
  // false after the simulated cleanup, silently dropping every future
  // fetch response and leaving "Pick the quiz" empty for the rest of this
  // component's real lifetime (e.g. every mount after a player logs out
  // and the join form remounts).
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
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
        setError(
          fetchError instanceof SessionApiError
            ? fetchError.message
            : 'Could not load live games',
        );
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Controlled value only reflects a code this list actually knows about —
  // a manually typed or QR-prefilled code shouldn't show as "selected" here.
  const selectValue = sessions.some((session) => session.joinCode === value)
    ? value
    : '';

  if (sessions.length === 0 && !error) return null;

  return (
    <div className="mt-2 flex flex-col gap-1">
      {sessions.length > 0 && (
        <>
          <label
            id="live-session-select-label"
            htmlFor="live-session-select-trigger"
            className="text-xs font-extrabold tracking-wide text-foreground/55"
          >
            Pick the quiz
          </label>
          <Select.Root value={selectValue} onValueChange={onSelectSession}>
            <Select.Trigger
              id="live-session-select-trigger"
              aria-labelledby="live-session-select-label"
              className="flex min-h-14 items-center justify-between rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold data-placeholder:text-foreground/45"
            >
              <Select.Value placeholder="Choose a running game…" />
              <Select.Icon>▾</Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                position="popper"
                sideOffset={4}
                className="w-(--radix-select-trigger-width) overflow-hidden rounded-2xl border-2 border-foreground/15 bg-white shadow-lg"
              >
                <Select.Viewport className="p-1">
                  {sessions.map((session) => (
                    <Select.Item
                      key={session.joinCode}
                      value={session.joinCode}
                      className="flex cursor-pointer flex-col rounded-xl px-3 py-2 text-sm font-bold outline-none data-highlighted:bg-magenta/10"
                    >
                      <Select.ItemText>{session.quizTitle}</Select.ItemText>
                      <span className="text-xs font-semibold text-foreground/55">
                        {session.joinCode}
                      </span>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </>
      )}
      {error && (
        <p role="alert" className="text-xs font-bold text-magenta">
          {error}
        </p>
      )}
    </div>
  );
}
