'use client';

import { useState } from 'react';
import { Dialog } from 'radix-ui';
import { Cross2Icon, ListBulletIcon } from '@radix-ui/react-icons';
import { AnsweredQuestionsList } from '@/app/play/answered-questions-list';
import type { OpenedQuestionEntry } from '@/app/play/opened-questions';

interface AnsweredQuestionsPanelProps {
  entries: OpenedQuestionEntry[];
  jumpableIds: Set<number>;
  onSelectQuestion: (questionId: number) => void;
}

/**
 * Review list of every question opened so far, plus the team's own (and,
 * once revealed, the correct) answer. On wider screens it sits as a sticky
 * sidebar next to the question form, scrolling internally so the form next
 * to it stays fully visible without scrolling the page; on mobile it's
 * tucked behind a bottom-sheet drawer instead, to save space on the
 * phone-sized /play layout.
 */
export function AnsweredQuestionsPanel({
  entries,
  jumpableIds,
  onSelectQuestion,
}: AnsweredQuestionsPanelProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  function handleDrawerSelectQuestion(questionId: number): void {
    onSelectQuestion(questionId);
    setIsDrawerOpen(false);
  }

  return (
    <section className="md:sticky md:top-5 md:w-80 md:shrink-0 md:self-start">
      <div className="hidden md:flex md:max-h-[calc(100vh-2.5rem)] md:flex-col md:gap-2">
        <h2 className="font-display text-lg text-magenta">Answer history</h2>
        <div className="overflow-y-auto pr-1">
          <AnsweredQuestionsList
            entries={entries}
            jumpableIds={jumpableIds}
            onSelectQuestion={onSelectQuestion}
          />
        </div>
      </div>
      <div className="md:hidden">
        <Dialog.Root open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 border-foreground/20 text-sm font-extrabold tracking-wide"
            >
              <ListBulletIcon aria-hidden="true" />
              Answer history ({entries.length})
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-30 bg-black/50" />
            <Dialog.Content className="fixed inset-x-0 bottom-0 z-40 flex max-h-[80vh] flex-col gap-4 overflow-y-auto rounded-t-2xl bg-background p-5">
              <div className="flex items-center justify-between">
                <Dialog.Title className="font-display text-lg text-magenta">
                  Answer history
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Close answer history"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-foreground/20"
                  >
                    <Cross2Icon aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>
              <AnsweredQuestionsList
                entries={entries}
                jumpableIds={jumpableIds}
                onSelectQuestion={handleDrawerSelectQuestion}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </section>
  );
}
