'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/use-auth';
import { SessionPickerPanel } from '@/app/sessions/session-picker-panel';

/** Admin-only landing screen for picking or starting a session — /admin owns every auth screen (login/register/pending), so anyone not already signed in bounces back there instead of duplicating those screens here. */
export default function SessionsPage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === 'unauthenticated' || auth.status === 'pending') {
      router.replace('/admin');
    }
  }, [auth.status, router]);

  if (auth.status !== 'authenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-display text-xl">Loading…</p>
      </main>
    );
  }

  return <SessionPickerPanel onOpenSession={(joinCode) => router.push(`/admin?code=${joinCode}`)} />;
}
