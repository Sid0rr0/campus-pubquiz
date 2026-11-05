'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/use-auth';

/**
 * Renders `children` only for a signed-in staff user (an admin when
 * `adminOnly`). Signed out or awaiting approval goes to /login; a moderator
 * on an admin-only page goes to /control.
 */
export function StaffGate({
  adminOnly = false,
  children,
}: {
  adminOnly?: boolean;
  children: ReactNode;
}) {
  const auth = useAuth();
  const router = useRouter();
  const allowed = isAllowed(auth, adminOnly);

  useEffect(() => {
    const target = redirectFor(auth.status, adminOnly, allowed);
    if (target) router.replace(target);
  }, [adminOnly, allowed, auth.status, router]);

  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-display text-xl">Loading…</p>
      </main>
    );
  }

  return children;
}

type Auth = ReturnType<typeof useAuth>;

function isAllowed(auth: Auth, adminOnly: boolean): boolean {
  const signedIn = auth.status === 'authenticated' && Boolean(auth.user);
  return signedIn && (!adminOnly || auth.user?.role === 'admin');
}

/** Signed out (or awaiting approval) goes to log in; a moderator on an admin-only page goes to /control. */
function redirectFor(
  status: Auth['status'],
  adminOnly: boolean,
  allowed: boolean,
): string | null {
  if (status === 'unauthenticated' || status === 'pending') return '/login';
  return adminOnly && status === 'authenticated' && !allowed
    ? '/control'
    : null;
}
