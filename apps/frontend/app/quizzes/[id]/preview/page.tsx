'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { StaffGate } from '@/app/components/staff-gate';
import { QuizPreviewPanel } from '@/app/quizzes/[id]/preview/quiz-preview-panel';

/** Staff-only quiz preview — any authenticated admin/moderator, like the quiz editor. */
export default function QuizPreviewPage() {
  const params = useParams<{ id: string }>();
  return (
    <StaffGate>
      {/* useSearchParams requires a Suspense boundary during static prerendering. */}
      <Suspense fallback={null}>
        <QuizPreviewPanel quizId={params.id} />
      </Suspense>
    </StaffGate>
  );
}
