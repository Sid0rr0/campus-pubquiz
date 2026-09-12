'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/use-auth';
import { TeamsDirectoryPanel } from '@/app/teams/teams-directory-panel';

export default function TeamsPage() {
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

  return <TeamsDirectoryPanel />;
}
