'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { LeagueFields, LeagueView } from '@campus-pubquiz/types';
import {
  addLeagueSession,
  createLeague,
  deleteLeague,
  fetchLeagues,
  LeaguesApiError,
  moveLeague,
  removeLeagueSession,
  updateLeague,
} from '@/app/lib/leagues-api';
import { fetchPlayedSessions } from '@/app/lib/stats-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { Button } from '@/app/components/button';
import { ConfirmDialog } from '@/app/components/confirm-dialog';

/** The most ended sessions the "Add a session" picker offers (the stats list's page-size cap). */
const PICKER_SESSIONS_LIMIT = 100;

const INPUT_CLASS =
  'rounded border border-foreground/35 px-2 py-1 text-sm text-foreground';

function toastError(fallback: string) {
  return (error: unknown) =>
    toast.error(apiErrorMessage(error, LeaguesApiError, fallback) ?? fallback);
}

interface LeagueFormProps {
  label: string;
  initial: LeagueFields;
  submitLabel: string;
  onSubmit: (fields: LeagueFields) => void;
  onCancel?: () => void;
  isPending: boolean;
}

function LeagueForm({
  label,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  isPending,
}: LeagueFormProps) {
  const [name, setName] = useState(initial.name);
  const [startsOn, setStartsOn] = useState(initial.startsOn);
  const [endsOn, setEndsOn] = useState(initial.endsOn);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    onSubmit({ name: name.trim(), startsOn, endsOn });
  }

  return (
    <form
      aria-label={label}
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3"
    >
      <label className="flex flex-col gap-1 text-sm font-bold">
        Name
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={INPUT_CLASS}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-bold">
        Starts
        <input
          required
          type="date"
          value={startsOn}
          onChange={(event) => setStartsOn(event.target.value)}
          className={INPUT_CLASS}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-bold">
        Ends
        <input
          required
          type="date"
          min={startsOn || undefined}
          value={endsOn}
          onChange={(event) => setEndsOn(event.target.value)}
          className={INPUT_CLASS}
        />
      </label>
      <Button type="submit" variant="solid-flat" size="sm" disabled={isPending}>
        {submitLabel}
      </Button>
      {onCancel && (
        <Button type="button" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </form>
  );
}

function LeagueCard({
  league,
  endedSessions,
  isFirst,
  isLast,
}: {
  league: LeagueView;
  endedSessions: { gameSessionId: number; name: string; playedAt: string }[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [pickedId, setPickedId] = useState('');
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.leagues.all });

  const updateMutation = useMutation({
    mutationFn: (fields: LeagueFields) => updateLeague(league.id, fields),
    onSuccess: () => {
      setIsEditing(false);
      return invalidate();
    },
    onError: toastError('Could not update league'),
  });
  const moveMutation = useMutation({
    mutationFn: (direction: 'up' | 'down') => moveLeague(league.id, direction),
    onSuccess: invalidate,
    onError: toastError('Could not move league'),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteLeague(league.id),
    onSuccess: invalidate,
    onError: toastError('Could not delete league'),
  });
  const addMutation = useMutation({
    mutationFn: (gameSessionId: number) =>
      addLeagueSession(league.id, gameSessionId),
    onSuccess: () => {
      setPickedId('');
      return invalidate();
    },
    onError: toastError('Could not add session'),
  });
  const removeMutation = useMutation({
    mutationFn: (gameSessionId: number) =>
      removeLeagueSession(league.id, gameSessionId),
    onSuccess: invalidate,
    onError: toastError('Could not remove session'),
  });

  const memberIds = new Set(league.sessions.map((s) => s.gameSessionId));
  const addable = endedSessions.filter((s) => !memberIds.has(s.gameSessionId));

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-foreground/15 p-4">
      {isEditing ? (
        <LeagueForm
          label={`Edit ${league.name}`}
          initial={league}
          submitLabel="Save"
          onSubmit={(fields) => updateMutation.mutate(fields)}
          onCancel={() => setIsEditing(false)}
          isPending={updateMutation.isPending}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display text-lg">{league.name}</h3>
          <span className="text-sm text-foreground/60">
            {league.startsOn} to {league.endsOn}
          </span>
          <span className="rounded border border-foreground/25 px-2 text-xs font-bold">
            {league.current ? 'Current' : 'Ended'}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              size="sm"
              aria-label={`Move ${league.name} up`}
              disabled={isFirst || moveMutation.isPending}
              onClick={() => moveMutation.mutate('up')}
            >
              ↑
            </Button>
            <Button
              type="button"
              size="sm"
              aria-label={`Move ${league.name} down`}
              disabled={isLast || moveMutation.isPending}
              onClick={() => moveMutation.mutate('down')}
            >
              ↓
            </Button>
            <Button
              type="button"
              size="sm"
              aria-label={`Edit ${league.name}`}
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
            <ConfirmDialog
              trigger={
                <Button
                  type="button"
                  size="sm"
                  aria-label={`Delete ${league.name}`}
                  className="rounded-lg border-2 border-magenta font-extrabold text-magenta"
                >
                  Delete
                </Button>
              }
              title="Delete this league?"
              description="Only the league and its list of sessions are removed. No session, team or answer is deleted."
              confirmLabel="Delete league"
              onConfirm={() => deleteMutation.mutate()}
            />
          </div>
        </div>
      )}

      {league.sessions.length === 0 ? (
        <p className="text-sm text-foreground/60">
          No sessions in this league yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {league.sessions.map((session) => (
            <li
              key={session.gameSessionId}
              className="flex items-center gap-3 text-sm"
            >
              <span className="font-bold">{session.name}</span>
              <span className="text-foreground/60">
                {session.playedAt.slice(0, 10)}
              </span>
              <Button
                type="button"
                size="sm"
                aria-label={`Remove ${session.name} from ${league.name}`}
                onClick={() => removeMutation.mutate(session.gameSessionId)}
                className="ml-auto"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      {addable.length === 0 ? (
        <p className="text-sm text-foreground/60">
          No ended sessions left to add.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={`Add a session to ${league.name}`}
            value={pickedId}
            onChange={(event) => setPickedId(event.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Choose a session…</option>
            {addable.map((session) => (
              <option key={session.gameSessionId} value={session.gameSessionId}>
                {session.name} ({session.playedAt.slice(0, 10)})
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            disabled={pickedId === '' || addMutation.isPending}
            onClick={() => addMutation.mutate(Number(pickedId))}
          >
            Add session
          </Button>
        </div>
      )}
    </li>
  );
}

export function LeaguesPanel() {
  const queryClient = useQueryClient();
  const leaguesQuery = useQuery({
    queryKey: queryKeys.leagues.list(),
    queryFn: ({ signal }) => fetchLeagues({}, signal),
  });
  const sessionsQuery = useQuery({
    queryKey: queryKeys.stats.sessions({
      page: 1,
      pageSize: PICKER_SESSIONS_LIMIT,
      sortBy: 'playedAt',
      sortOrder: 'desc',
    }),
    queryFn: ({ signal }) =>
      fetchPlayedSessions(
        {
          page: 1,
          pageSize: PICKER_SESSIONS_LIMIT,
          sortBy: 'playedAt',
          sortOrder: 'desc',
        },
        signal,
      ),
  });
  const createMutation = useMutation({
    mutationFn: (fields: LeagueFields) => createLeague(fields),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.leagues.all }),
    onError: toastError('Could not create league'),
  });

  const leagues = leaguesQuery.data?.items ?? null;
  const error = apiErrorMessage(
    leaguesQuery.error,
    LeaguesApiError,
    'Could not load leagues',
  );
  const endedSessions = (sessionsQuery.data?.items ?? []).map((s) => ({
    gameSessionId: s.gameSessionId,
    name: s.name,
    playedAt: s.playedAt,
  }));

  if (!leagues) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        {error ? (
          <p role="alert" className="font-extrabold text-magenta">
            {error}
          </p>
        ) : (
          <p className="font-display text-xl">Loading…</p>
        )}
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-background p-6 text-foreground">
      <h1 className="font-display text-2xl">Leagues</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg">New league</h2>
        <LeagueForm
          label="New league"
          initial={{ name: '', startsOn: '', endsOn: '' }}
          submitLabel="Create league"
          onSubmit={(fields) => createMutation.mutate(fields)}
          isPending={createMutation.isPending}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg">All leagues</h2>
        {leagues.length > 1 && (
          <p className="text-sm text-foreground/60">
            Use the arrows to put a league first. The public league page shows
            this order, with current leagues always before ended ones.
          </p>
        )}
        {leagues.length === 0 ? (
          <p className="text-sm text-foreground/60">
            No leagues yet. Create one above.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {leagues.map((league, index) => (
              <LeagueCard
                key={league.id}
                league={league}
                isFirst={index === 0}
                isLast={index === leagues.length - 1}
                endedSessions={endedSessions}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
