'use client';

import { useParams } from 'next/navigation';
import { StaffGate } from '@/app/components/staff-gate';
import { QuizEditorPanel } from '@/app/quizzes/[id]/quiz-editor-panel';

/** Create/edit quiz page — `/quizzes/new` starts a blank draft, `/quizzes/<id>` loads an existing quiz. Any authenticated admin/moderator can use it, matching /sessions. */
export default function QuizEditorPage() {
  const params = useParams<{ id: string }>();
  return (
    <StaffGate>
      <QuizEditorPanel quizId={params.id} />
    </StaffGate>
  );
}
