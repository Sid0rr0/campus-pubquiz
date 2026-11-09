import type { QuestionView } from '@campus-pubquiz/types';

/** "Clue N of M" for the Clue question on air; nothing for any other question. */
export function ClueStatus({
  question,
}: {
  question: Pick<QuestionView, 'clues' | 'clueCount'> | null;
}) {
  if (!question?.clues || question.clueCount === undefined) return null;
  return (
    <p className="text-sm font-bold text-cyan">
      Clue {question.clues.length} of {question.clueCount}
    </p>
  );
}
