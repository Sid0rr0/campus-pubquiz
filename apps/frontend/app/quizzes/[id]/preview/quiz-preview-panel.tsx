'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DEFAULT_QUIZ_PREVIEW_MODE,
  type QuizPreviewPayload,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { DisplayScreenView } from '@/app/components/display-screen-view';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import {
  fetchQuizPreview,
  QuizPreviewApiError,
} from '@/app/lib/quiz-preview-api';

interface QuizPreviewPanelProps {
  quizId: string;
}

function FullPageMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-foreground">
      {children}
    </main>
  );
}

/** Steps through a saved quiz's big-screen screens in a 16:9 frame. Nothing is stored and no session exists. */
export function QuizPreviewPanel({ quizId }: QuizPreviewPanelProps) {
  const numericQuizId = Number(quizId);
  const mode = DEFAULT_QUIZ_PREVIEW_MODE;
  const query = useQuery({
    queryKey: queryKeys.quizzes.preview(numericQuizId, mode),
    queryFn: ({ signal }) => fetchQuizPreview(numericQuizId, mode, signal),
    // A preview is a read of the saved quiz: always fetch it fresh on open.
    gcTime: 0,
    retry: false,
  });

  if (query.isPending) {
    return (
      <FullPageMessage>
        <p className="font-display text-xl">Loading…</p>
      </FullPageMessage>
    );
  }

  if (query.isError) {
    const isNotFound =
      query.error instanceof QuizPreviewApiError && query.error.status === 404;
    return (
      <FullPageMessage>
        <p role="alert" className="font-display text-xl text-magenta">
          {isNotFound
            ? 'Quiz not found. It may have been deleted.'
            : apiErrorMessage(
                query.error,
                QuizPreviewApiError,
                'Could not load the quiz preview.',
              )}
        </p>
      </FullPageMessage>
    );
  }

  return <PreviewStepper preview={query.data} />;
}

function PreviewStepper({ preview }: { preview: QuizPreviewPayload }) {
  const { steps, quiz } = preview;
  const [index, setIndex] = useState(0);
  const lastIndex = steps.length - 1;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') {
        setIndex((current) => Math.min(current + 1, lastIndex));
      } else if (event.key === 'ArrowLeft') {
        setIndex((current) => Math.max(current - 1, 0));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lastIndex]);

  if (steps.length === 0) {
    return (
      <FullPageMessage>
        <p className="font-display text-xl">
          Nothing to preview yet. Add a round and some questions, then save.
        </p>
      </FullPageMessage>
    );
  }

  const step = steps[index];

  return (
    <main className="flex h-dvh flex-col gap-3 bg-foreground p-4 text-background">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="md"
          onClick={() => setIndex((current) => Math.max(current - 1, 0))}
          disabled={index === 0}
          className="rounded-xl border-2 border-background/50 text-xs font-extrabold disabled:opacity-50"
        >
          Prev
        </Button>
        <Button
          type="button"
          size="md"
          onClick={() =>
            setIndex((current) => Math.min(current + 1, lastIndex))
          }
          disabled={index === lastIndex}
          className="rounded-xl bg-magenta text-xs font-extrabold text-white disabled:opacity-50"
        >
          Next
        </Button>
        <span className="text-xs font-bold text-background/70">
          Step {index + 1} of {steps.length}
        </span>
        {step.isBlockEnd && (
          <span className="rounded-full bg-cyan px-4 py-1 text-xs font-extrabold uppercase tracking-wide text-foreground">
            Block ends here
          </span>
        )}
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div
          className="flex aspect-video max-h-full max-w-full flex-col overflow-hidden bg-background text-foreground"
          style={{ height: '100%', maxWidth: 'calc((100dvh - 6rem) * 16 / 9)' }}
          data-testid="preview-frame"
        >
          <DisplayScreenView screen={step.screen} quiz={quiz} />
        </div>
      </div>
    </main>
  );
}
