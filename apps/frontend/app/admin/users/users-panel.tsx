'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckIcon, LockClosedIcon } from '@radix-ui/react-icons';
import type { UserRole, UsersListedPayload } from '@campus-pubquiz/types';
import { approveUser, deactivateUser, fetchUsers } from '@/app/lib/auth-api';

export function UsersPanel() {
  const [users, setUsers] = useState<UsersListedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roleSelections, setRoleSelections] = useState<
    Record<number, UserRole>
  >({});
  // Bumped on every refetch() call so an in-flight response from a
  // superseded request (e.g. a second Approve click before the first
  // refetch resolves) can be told apart from the latest one and ignored.
  const requestGenerationRef = useRef(0);

  const refetch = useCallback(() => {
    const requestGeneration = ++requestGenerationRef.current;
    fetchUsers()
      .then((payload) => {
        if (requestGeneration !== requestGenerationRef.current) return;
        setUsers(payload);
        setError(null);
      })
      .catch((fetchError: unknown) => {
        if (requestGeneration !== requestGenerationRef.current) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Could not load users',
        );
      });
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function handleApprove(userId: number): Promise<void> {
    const role = roleSelections[userId] ?? 'moderator';
    try {
      await approveUser(userId, role);
      refetch();
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : 'Could not approve user',
      );
    }
  }

  async function handleDeactivate(userId: number): Promise<void> {
    try {
      await deactivateUser(userId);
      refetch();
    } catch (deactivateError) {
      setError(
        deactivateError instanceof Error
          ? deactivateError.message
          : 'Could not deactivate user',
      );
    }
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
              <button
                type="button"
                onClick={() => void handleApprove(pendingUser.id)}
                className="ml-auto flex items-center gap-1.5 rounded-lg bg-magenta px-3 py-1 text-sm font-extrabold text-white"
              >
                <CheckIcon aria-hidden="true" />
                Approve
              </button>
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
              <button
                type="button"
                onClick={() => void handleDeactivate(activeUser.id)}
                className="ml-auto flex items-center gap-1.5 rounded-lg border border-magenta px-3 py-1 text-sm font-extrabold text-magenta"
              >
                <LockClosedIcon aria-hidden="true" />
                Deactivate
              </button>
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
