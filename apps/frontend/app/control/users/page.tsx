'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/use-auth';
import { UsersPanel } from '@/app/control/users/users-panel';

export default function UsersPage() {
  const auth = useAuth();
  const router = useRouter();
  const isAdmin =
    auth.status === 'authenticated' && auth.user?.role === 'admin';

  useEffect(() => {
    if (auth.status === 'unauthenticated' || auth.status === 'pending') {
      router.replace('/control');
    } else if (auth.status === 'authenticated' && auth.user?.role !== 'admin') {
      router.replace('/control');
    }
  }, [auth.status, auth.user, router]);

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-display text-xl">Loading…</p>
      </main>
    );
  }

  return <UsersPanel />;
}
