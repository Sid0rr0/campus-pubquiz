import { AnsweredQuestionsList } from '@/app/play/answered-questions-list';
import type { OpenedQuestionEntry } from '@/app/play/opened-questions';

interface AnsweredQuestionsPanelProps {
  entries: OpenedQuestionEntry[];
  jumpableIds: Set<number>;
  onSelectQuestion: (questionId: number) => void;
}

/**
 * Review list of every question opened so far, plus the team's own (and,
 * once revealed, the correct) answer. Sits as a sticky sidebar next to the
 * question form on wider screens, scrolling internally so the form next to
 * it stays fully visible without scrolling the page. On mobile this is
 * reached through MobileQuizActionsBar's drawer trigger instead, to save
 * space on the phone-sized /play layout.
 */
export function AnsweredQuestionsPanel({
  entries,
  jumpableIds,
  onSelectQuestion,
}: AnsweredQuestionsPanelProps) {
  return (
    <section className="hidden md:sticky md:top-5 md:flex md:max-h-[calc(100vh-2.5rem)] md:w-80 md:shrink-0 md:flex-col md:gap-2 md:self-start">
      <h2 className="font-display text-lg text-magenta">Answer history</h2>
      <div className="overflow-y-auto pr-1">
        <AnsweredQuestionsList
          entries={entries}
          jumpableIds={jumpableIds}
          onSelectQuestion={onSelectQuestion}
        />
      </div>
    </section>
  );
}
