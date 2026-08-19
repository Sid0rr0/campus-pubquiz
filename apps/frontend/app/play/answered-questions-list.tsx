import { formatAnswerValue } from '@/app/lib/format-answer-value';
import type { OpenedQuestionEntry } from '@/app/play/opened-questions';

interface AnsweredQuestionsListProps {
  entries: OpenedQuestionEntry[];
  /** Question ids that can currently be jumped to in the browser above (the active block's questions) — entries outside this set render as plain, unclickable rows. */
  jumpableIds: Set<number>;
  onSelectQuestion: (questionId: number) => void;
}

export function AnsweredQuestionsList({
  entries,
  jumpableIds,
  onSelectQuestion,
}: AnsweredQuestionsListProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-foreground/55">No questions opened yet.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {entries.map((entry) => {
        const isJumpable = jumpableIds.has(entry.id);
        const body = (
          <>
            <p className="text-xs font-extrabold tracking-wide text-foreground/45">
              {entry.roundTitle} · Q{entry.questionNumberInRound}
            </p>
            <p className="text-[15px] font-bold">{entry.prompt}</p>
            <p className="mt-1 text-sm">
              <span className="font-extrabold text-foreground/55">You: </span>
              {entry.myAnswer
                ? formatAnswerValue(entry.myAnswer, entry.type, entry.options)
                : 'No answer submitted'}
            </p>
            {entry.correctAnswer !== null && (
              <p className="text-sm text-green">
                <span className="font-extrabold text-foreground/55">
                  Correct:{' '}
                </span>
                {formatAnswerValue(
                  entry.correctAnswer,
                  entry.type,
                  entry.options,
                )}
              </p>
            )}
          </>
        );

        if (!isJumpable) {
          return (
            <li
              key={entry.id}
              className="rounded-xl border border-foreground/15 bg-white px-4 py-3"
            >
              {body}
            </li>
          );
        }

        return (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onSelectQuestion(entry.id)}
              className="w-full rounded-xl border border-foreground/15 bg-white px-4 py-3 text-left transition hover:border-magenta"
            >
              {body}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
