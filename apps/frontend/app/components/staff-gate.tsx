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
  const signedIn = auth.status === 'authenticated' && Boolean(auth.user);
  const allowed = signedIn && (!adminOnly || auth.user?.role === 'admin');

  useEffect(() => {
    if (auth.status === 'unauthenticated' || auth.status === 'pending') {
      router.replace('/login');
    } else if (adminOnly && auth.status === 'authenticated' && !allowed) {
      router.replace('/control');
    }
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
