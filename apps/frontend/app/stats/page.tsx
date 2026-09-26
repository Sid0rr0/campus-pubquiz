'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/use-auth';
import { PlayedSessionsPanel } from '@/app/stats/played-sessions-panel';

export default function StatsPage() {
  const auth = useAuth();
  const router = useRouter();
  const isAuthenticated = auth.status === 'authenticated' && Boolean(auth.user);

  useEffect(() => {
    if (auth.status === 'unauthenticated' || auth.status === 'pending') {
      router.replace('/login');
    }
  }, [auth.status, router]);

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-display text-xl">Loading…</p>
      </main>
    );
  }

  return <PlayedSessionsPanel />;
}
