'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/use-auth';
import { GuideContent } from '@/app/control/guide/guide-content';

export default function GuidePage() {
  const auth = useAuth();
  const router = useRouter();
  const isAuthenticated = auth.status === 'authenticated';

  useEffect(() => {
    if (auth.status === 'unauthenticated' || auth.status === 'pending') {
      router.replace('/control');
    }
  }, [auth.status, router]);

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-display text-xl">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <GuideContent />
    </main>
  );
}
