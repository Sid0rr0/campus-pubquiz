'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/use-auth';
import { QuizEditorPanel } from '@/app/quizzes/[id]/quiz-editor-panel';

/** Create/edit quiz page — `/quizzes/new` starts a blank draft, `/quizzes/<id>` loads an existing quiz. Any authenticated admin/moderator can use it, matching /sessions. */
export default function QuizEditorPage() {
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

  return <QuizEditorPanel quizId={params.id} />;
}
