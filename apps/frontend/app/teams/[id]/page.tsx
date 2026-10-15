'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/use-auth';
import { TeamDetailPanel } from '@/app/teams/[id]/team-detail-panel';

/** One team's history across its ended sessions — /teams/<teamId>. Any
 * authenticated admin/moderator can use it, matching /teams and /stats. */
export default function TeamDetailPage() {
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

  return <TeamDetailPanel teamId={Number(params.id)} />;
}
