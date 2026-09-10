'use client';

import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select } from 'radix-ui';
import type { ActiveSessionSummary } from '@campus-pubquiz/types';
import { fetchPublicSessions, SessionApiError } from '@/app/lib/sessions-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';

const EMPTY_SESSIONS: ActiveSessionSummary[] = [];

interface LiveSessionSelectProps {
  value: string;
  onSelectSession: (joinCode: string) => void;
}

/**
 * Lets a joining team pick a running game from the unauthenticated
 * `/sessions/public` list (same endpoint `/display` uses) instead of typing
 * its join code by hand. Both callers (`/play` and the home page) hide the
 * manual Game code field, so this is the only way to choose a session —
 * it stays on screen (disabled, with a "no games yet" placeholder) rather
 * than disappearing when the list is empty, since a team can land here
 * before the admin has started a session.
 */
export function LiveSessionSelect({
  value,
  onSelectSession,
}: LiveSessionSelectProps) {
  const sessionsQuery = useQuery({
    queryKey: queryKeys.sessions.public(),
    queryFn: fetchPublicSessions,
  });
  const sessions = sessionsQuery.data ?? EMPTY_SESSIONS;
  const error = apiErrorMessage(
    sessionsQuery.error,
    SessionApiError,
    'Could not load live games',
  );

  // Controlled value only reflects a code this list actually knows about —
  // a manually typed or QR-prefilled code shouldn't show as "selected" here.
  const selectValue = sessions.some((session) => session.joinCode === value)
    ? value
    : '';
  const hasSessions = sessions.length > 0;

  // Touch-only Radix quirk: tapping the trigger while open first closes it
  // via the content's outside-pointerdown dismiss, but the synthetic click
  // that follows on touch devices reopens it immediately (Radix's touch
  // path opens on click, not pointerdown) — net effect, tapping never
  // closes it. The content also disables pointer-events on the rest of the
  // page while open, so that outside-pointerdown's *target* isn't actually
  // the trigger (hit-testing falls through to <html>) — compare the
  // pointer's coordinates against the trigger's rect instead of its target.
  // Flag it, then swallow that one reopening click.
  const triggerRef = useRef<HTMLButtonElement>(null);
  const suppressReopenRef = useRef(false);

  return (
    <div className="mt-2 flex flex-col gap-1">
      <label
        id="live-session-select-label"
        htmlFor="live-session-select-trigger"
        className="text-xs font-extrabold tracking-wide text-foreground/55"
      >
        Pick the quiz
      </label>
      <Select.Root
        value={selectValue}
        onValueChange={(nextValue) => {
          // Radix's hidden native <select> mirror can re-sync to a blank
          // option (and fire this with '') when the trigger's disabled
          // state flips during a remount (e.g. this control briefly leaves
          // and re-enters the tree while the join form is up) — a real
          // pick is always a non-empty join code, so an empty value here is
          // never a deliberate selection and must not clobber codeInput.
          if (nextValue) onSelectSession(nextValue);
        }}
      >
        <Select.Trigger
          ref={triggerRef}
          id="live-session-select-trigger"
          aria-labelledby="live-session-select-label"
          disabled={!hasSessions}
          onClick={(event) => {
            if (suppressReopenRef.current) {
              suppressReopenRef.current = false;
              event.preventDefault();
            }
          }}
          className="flex min-h-14 items-center justify-between rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold data-placeholder:text-foreground/45 disabled:opacity-60"
        >
          <Select.Value
            placeholder={
              hasSessions ? 'Choose a running game…' : 'No games running yet'
            }
          />
          <Select.Icon>▾</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={4}
            onPointerDownOutside={(event) => {
              const trigger = triggerRef.current;
              if (!trigger) return;
              const { clientX, clientY } = event.detail.originalEvent;
              const rect = trigger.getBoundingClientRect();
              const isOnTrigger =
                clientX >= rect.left &&
                clientX <= rect.right &&
                clientY >= rect.top &&
                clientY <= rect.bottom;
              if (isOnTrigger) {
                suppressReopenRef.current = true;
                // Safety net: if the click that normally follows this
                // pointerdown never arrives (e.g. the tap turns into a
                // scroll and gets cancelled), don't leave the flag stuck
                // and eat the next, unrelated open-tap.
                setTimeout(() => {
                  suppressReopenRef.current = false;
                }, 500);
              }
            }}
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
      {error && (
        <p role="alert" className="text-xs font-bold text-magenta">
          {error}
        </p>
      )}
    </div>
  );
}
