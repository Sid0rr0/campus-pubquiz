'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/use-auth';
import { FeedbackTrendsPanel } from '@/app/stats/feedback/feedback-trends-panel';

/** Feedback across sessions — /stats/feedback. Any authenticated admin/moderator can use it, matching /stats. */
export default function FeedbackTrendsPage() {
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

  return <FeedbackTrendsPanel />;
}
