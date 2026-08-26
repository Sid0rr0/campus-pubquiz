'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon, ReloadIcon } from '@radix-ui/react-icons';
import type { ActiveSessionSummary } from '@campus-pubquiz/types';
import { fetchPublicSessions, SessionApiError } from '@/app/lib/sessions-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { Button } from '@/app/components/button';
import { CopyButton } from '@/app/components/copy-button';

const EMPTY_SESSIONS: ActiveSessionSummary[] = [];

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
export function DisplaySessionPicker({
  onSelectSession,
  connectionError,
}: DisplaySessionPickerProps) {
  const sessionsQuery = useQuery({
    queryKey: queryKeys.sessions.public(),
    queryFn: fetchPublicSessions,
  });
  const sessions = sessionsQuery.data ?? EMPTY_SESSIONS;
  const error = apiErrorMessage(
    sessionsQuery.error,
    SessionApiError,
    'Could not load sessions',
  );
  // isFetching (not isLoading) so the button also reads "Refreshing…" during
  // a manual refetch that already has cached data, matching the old manual
  // isLoading flag which covered both the first load and every refresh.
  const isLoading = sessionsQuery.isFetching;

  function handleRefreshClick() {
    void sessionsQuery.refetch();
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
        <p className="text-foreground/55">
          No games running yet — start one from the admin console.
        </p>
      )}
      <ul className="flex w-full max-w-xl flex-col gap-3">
        {sessions.map((session) => (
          <li
            key={session.joinCode}
            className="flex min-h-16 items-center gap-2 rounded-2xl border-2 border-foreground/15 bg-white pl-5 pr-3"
          >
            <Button
              type="button"
              onClick={() => onSelectSession(session.joinCode)}
              className="flex flex-1 items-center justify-between py-3 text-left"
            >
              <span className="flex flex-col">
                <span className="font-extrabold">{session.quizTitle}</span>
                <span className="text-xs text-foreground/55">
                  {session.status} · {session.teamCount} teams ·{' '}
                  {session.joinCode}
                </span>
              </span>
              <span className="flex items-center gap-1 font-display text-lg text-magenta">
                Watch
                <ArrowRightIcon aria-hidden="true" />
              </span>
            </Button>
            <CopyButton value={session.joinCode} />
          </li>
        ))}
      </ul>
      <Button
        type="button"
        onClick={handleRefreshClick}
        disabled={isLoading}
        variant="text-quiet"
        className="flex disabled:opacity-40"
      >
        <ReloadIcon aria-hidden="true" />
        {isLoading ? 'Refreshing…' : 'Refresh'}
      </Button>
    </main>
  );
}
