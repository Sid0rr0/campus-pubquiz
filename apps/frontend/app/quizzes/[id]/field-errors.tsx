'use client';

import type { QuizDraftIssue } from '@campus-pubquiz/types';

/** Issues from a save-validation response for one particular field, joined into the message an inline `FieldErrors` renders. */
export function fieldIssues(
  issues: QuizDraftIssue[],
  field: string,
): QuizDraftIssue[] {
  return issues.filter((issue) => issue.field === field);
}

interface FieldErrorsProps {
  issues: QuizDraftIssue[];
}

/** Inline validation message shown next to the field it applies to, once a save attempt has surfaced issues. */
export function FieldErrors({ issues }: FieldErrorsProps) {
  if (issues.length === 0) return null;
  return (
    <p role="alert" className="text-xs font-extrabold text-magenta">
      {issues.map((issue) => issue.message).join('; ')}
    </p>
  );
}
