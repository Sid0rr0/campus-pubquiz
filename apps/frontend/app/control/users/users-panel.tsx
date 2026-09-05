'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckIcon, LockClosedIcon } from '@radix-ui/react-icons';
import type { UserRole } from '@campus-pubquiz/types';
import { approveUser, deactivateUser, fetchUsers } from '@/app/lib/auth-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { Button } from '@/app/components/button';

export function UsersPanel() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: ({ signal }) => fetchUsers(signal),
  });
  const users = usersQuery.data ?? null;
  // This panel's existing convention unwraps as `instanceof Error` (not a
  // specific ApiError subclass) — preserved rather than switched to
  // AuthApiError, since that would surface a different fallback message.
  const error = apiErrorMessage(
    usersQuery.error,
    Error,
    'Could not load users',
  );

  const [roleSelections, setRoleSelections] = useState<
    Record<number, UserRole>
  >({});

  const invalidateUsers = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });

  const approveMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: UserRole }) =>
      approveUser(userId, role),
    onSuccess: invalidateUsers,
    onError: (approveError) =>
      toast.error(
        apiErrorMessage(approveError, Error, 'Could not approve user') ??
          'Could not approve user',
      ),
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: number) => deactivateUser(userId),
    onSuccess: invalidateUsers,
    onError: (deactivateError) =>
      toast.error(
        apiErrorMessage(deactivateError, Error, 'Could not deactivate user') ??
          'Could not deactivate user',
      ),
  });

  function handleApprove(userId: number): void {
    const role = roleSelections[userId] ?? 'moderator';
    approveMutation.mutate({ userId, role });
  }

  function handleDeactivate(userId: number): void {
    deactivateMutation.mutate(userId);
  }

  if (!users) {
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
      <h1 className="font-display text-2xl">Users</h1>
      {error && (
        <p role="alert" className="font-extrabold text-magenta">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg">Pending approval</h2>
        {users.pending.length === 0 && (
          <p className="text-sm text-foreground/60">No pending accounts.</p>
        )}
        <ul className="flex flex-col gap-2">
          {users.pending.map((pendingUser) => (
            <li
              key={pendingUser.id}
              className="flex items-center gap-3 rounded-lg border border-foreground/15 p-3"
            >
              <span className="font-bold">{pendingUser.username}</span>
              <select
                aria-label={`Role for ${pendingUser.username}`}
                value={roleSelections[pendingUser.id] ?? 'moderator'}
                onChange={(event) =>
                  setRoleSelections((current) => ({
                    ...current,
                    [pendingUser.id]: event.target.value as UserRole,
                  }))
                }
                className="rounded border border-foreground/35 px-2 py-1 text-sm"
              >
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
              <Button
                type="button"
                variant="solid-flat"
                size="sm"
                onClick={() => handleApprove(pendingUser.id)}
                className="ml-auto"
              >
                <CheckIcon aria-hidden="true" />
                Approve
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg">Active</h2>
        <ul className="flex flex-col gap-2">
          {users.active.map((activeUser) => (
            <li
              key={activeUser.id}
              className="flex items-center gap-3 rounded-lg border border-foreground/15 p-3"
            >
              <span className="font-bold">{activeUser.username}</span>
              <span className="text-sm text-foreground/60">
                {activeUser.role}
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => handleDeactivate(activeUser.id)}
                className="ml-auto rounded-lg border-2 border-magenta font-extrabold text-magenta"
              >
                <LockClosedIcon aria-hidden="true" />
                Deactivate
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg">Deactivated</h2>
        <ul className="flex flex-col gap-2">
          {users.deactivated.map((deactivatedUser) => (
            <li
              key={deactivatedUser.id}
              className="flex items-center gap-3 rounded-lg border border-foreground/15 p-3 opacity-60"
            >
              <span className="font-bold">{deactivatedUser.username}</span>
              <span className="text-sm text-foreground/60">
                {deactivatedUser.role}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
