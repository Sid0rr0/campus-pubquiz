'use client';

import { Suspense, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/use-auth';
import { QuizPreviewPanel } from '@/app/quizzes/[id]/preview/quiz-preview-panel';

/** Staff-only quiz preview — any authenticated admin/moderator, like the quiz editor. */
export default function QuizPreviewPage() {
  const auth = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  useEffect(() => {
    if (auth.status === 'unauthenticated' || auth.status === 'pending') {
      router.replace('/login');
    }
  }, [auth.status, router]);

  if (auth.status !== 'authenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-display text-xl">Loading…</p>
      </main>
    );
  }

  // useSearchParams requires a Suspense boundary during static prerendering.
  return (
    <Suspense fallback={null}>
      <QuizPreviewPanel quizId={params.id} />
    </Suspense>
  );
}
