'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/use-auth';
import { SessionDetailPanel } from '@/app/stats/[id]/session-detail-panel';

/** Deep-dive stats for one ended session — /stats/<gameSessionId>. Any
 * authenticated admin/moderator can use it, matching /stats. */
export default function SessionDetailPage() {
  const auth = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
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

  return <SessionDetailPanel gameSessionId={Number(params.id)} />;
}
