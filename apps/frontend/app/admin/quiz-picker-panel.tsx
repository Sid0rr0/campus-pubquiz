'use client';

import { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import type { GameStatus, QuizzesListedPayload } from '@campus-pubquiz/types';
import { RoundsList } from '@/app/components/rounds-list';

interface QuizPickerPanelProps {
  progressStatus: GameStatus;
  quizzes: QuizzesListedPayload;
  displayedActiveQuizId: number | null;
  onSelectQuiz: (quizId: number) => void;
}

/** Quiz picker shown only in the lobby/ended screens — manages its own "pending selection, awaiting confirmation" state, which resets for free whenever the panel unmounts (i.e. as soon as the game leaves lobby/ended). */
export function QuizPickerPanel({ progressStatus, quizzes, displayedActiveQuizId, onSelectQuiz }: QuizPickerPanelProps) {
  const [pendingQuizId, setPendingQuizId] = useState<number | null>(null);
  const pendingQuizTitle = quizzes.quizzes.find((quiz) => quiz.id === pendingQuizId)?.title ?? null;

  function handleConfirm(): void {
    if (!pendingQuizId) return;
    onSelectQuiz(pendingQuizId);
    setPendingQuizId(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl">{progressStatus === 'ended' ? 'Choose New Quiz' : 'Choose Quiz'}</h2>
      <ul className="flex flex-col gap-2">
        {quizzes.quizzes.map((quiz) => {
          const isActive = quiz.id === displayedActiveQuizId;
          const isPending = quiz.id === pendingQuizId;
          return (
            <li key={quiz.id}>
              <Collapsible.Root open={isPending} onOpenChange={(open) => setPendingQuizId(open ? quiz.id : null)}>
                <Collapsible.Trigger asChild>
                  <button
                    type="button"
                    aria-label={
                      isPending
                        ? `${quiz.title} selected, awaiting confirmation`
                        : isActive
                          ? `Restart quiz ${quiz.title}`
                          : `Select quiz ${quiz.title}`
                    }
                    className={
                      isPending
                        ? 'flex min-h-11 w-full items-center justify-between rounded-xl border-2 border-magenta bg-white px-4 font-extrabold'
                        : isActive
                          ? 'flex min-h-11 w-full items-center justify-between rounded-xl border-2 border-cyan bg-white px-4 font-extrabold'
                          : 'flex min-h-11 w-full items-center justify-between rounded-xl border border-foreground/15 bg-white px-4 font-extrabold'
                    }
                  >
                    <span>{quiz.title}</span>
                    {isPending && <span className="text-sm text-magenta">selected</span>}
                    {!isPending && isActive && <span className="text-sm text-cyan">active</span>}
                  </button>
                </Collapsible.Trigger>
                <Collapsible.Content className="mt-2">
                  <RoundsList rounds={quiz.rounds} />
                </Collapsible.Content>
              </Collapsible.Root>
            </li>
          );
        })}
      </ul>
      {pendingQuizId && (
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-magenta bg-white px-4 py-3">
          <p className="text-sm font-bold">
            {pendingQuizId === displayedActiveQuizId
              ? `Restart "${pendingQuizTitle}"? This clears teams and answers.`
              : `Start "${pendingQuizTitle}"? This replaces the current game session.`}
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setPendingQuizId(null)}
              className="min-h-10 rounded-lg border-2 border-foreground/30 px-4 text-sm font-extrabold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="min-h-10 rounded-lg bg-magenta px-4 text-sm font-extrabold text-white"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
