'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  DEFAULT_QUIZ_PREVIEW_MODE,
  QUIZ_PREVIEW_MODES,
  type QuizPreviewHostOnly,
  type QuizPreviewMode,
  type QuizPreviewPayload,
  type QuizPreviewStep,
} from '@campus-pubquiz/types';
import {
  quizPreviewHref,
  stepIndexAt,
  stepPosition,
} from '@/app/lib/quiz-preview-position';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  // The default order is left out of the URL; anything unknown means the default.
  const modeParam = searchParams.get('mode');
  const mode: QuizPreviewMode =
    QUIZ_PREVIEW_MODES.find((option) => option === modeParam) ??
    DEFAULT_QUIZ_PREVIEW_MODE;
  // Jokers add a joker pick to the night order only; the other order ignores the switch.
  const withJokers = mode === 'night' && searchParams.get('jokers') === 'true';
  // The default order, jokers off and the first step (at === null) are left out of the URL.
  const writeUrl = (
    nextMode: QuizPreviewMode,
    nextWithJokers: boolean,
    at: string | null,
  ) =>
    router.replace(
      quizPreviewHref(quizId, {
        mode: nextMode === DEFAULT_QUIZ_PREVIEW_MODE ? undefined : nextMode,
        withJokers: nextMode === 'night' && nextWithJokers,
        at: at ?? undefined,
      }),
    );
  const query = useQuery({
    queryKey: queryKeys.quizzes.preview(numericQuizId, mode, withJokers),
    queryFn: ({ signal }) =>
      fetchQuizPreview(numericQuizId, mode, withJokers, signal),
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

  return (
    <PreviewStepper
      key={`${mode}-${withJokers}`}
      preview={query.data}
      mode={mode}
      withJokers={withJokers}
      // Read when the stepper mounts (on load, or after the order changed); stepping only writes it.
      initialAt={searchParams.get('at')}
      onPositionChange={(at) => writeUrl(mode, withJokers, at)}
      onModeChange={(next, at) => writeUrl(next, withJokers, at)}
      onJokersChange={(next, at) => writeUrl(mode, next, at)}
    />
  );
}

interface JumpRound {
  roundIndex: number;
  title: string;
  stepIndex: number;
  questions: { questionIndex: number; prompt: string; stepIndex: number }[];
}

/** The rounds and questions the side list offers, each pointing at the step that opens it. */
function jumpRounds(steps: QuizPreviewStep[]): JumpRound[] {
  const rounds: JumpRound[] = [];
  steps.forEach((step, stepIndex) => {
    const { screen } = step;
    if (screen.kind === 'round_title') {
      rounds.push({
        roundIndex: step.roundIndex,
        title: screen.title,
        stepIndex,
        questions: [],
      });
    } else if (screen.kind === 'question' && step.questionIndex !== null) {
      rounds
        .find((round) => round.roundIndex === step.roundIndex)
        ?.questions.push({
          questionIndex: step.questionIndex,
          prompt: screen.question.prompt,
          stepIndex,
        });
    }
  });
  return rounds;
}

function JumpList({
  steps,
  currentIndex,
  onJump,
}: {
  steps: QuizPreviewStep[];
  currentIndex: number;
  onJump: (index: number) => void;
}) {
  const current = steps[currentIndex];
  const jumpButtonClass = (isCurrent: boolean) =>
    `w-full rounded-lg px-2 py-1 text-left text-xs ${
      isCurrent ? 'bg-background text-foreground' : 'hover:bg-background/15'
    }`;
  return (
    <nav
      aria-label="Jump to"
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border-2 border-background/30 p-2"
    >
      {jumpRounds(steps).map((round) => (
        <div key={round.roundIndex} className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => onJump(round.stepIndex)}
            aria-current={
              current.roundIndex === round.roundIndex &&
              current.questionIndex === null
                ? 'step'
                : undefined
            }
            className={`${jumpButtonClass(
              current.roundIndex === round.roundIndex &&
                current.questionIndex === null,
            )} font-extrabold`}
          >
            {round.roundIndex + 1}. {round.title}
          </button>
          {round.questions.map((question) => {
            const isCurrent =
              current.roundIndex === round.roundIndex &&
              current.questionIndex === question.questionIndex;
            return (
              <button
                key={question.questionIndex}
                type="button"
                onClick={() => onJump(question.stepIndex)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`${jumpButtonClass(isCurrent)} truncate pl-5 font-bold`}
              >
                {question.questionIndex + 1}. {question.prompt}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** The text the room never sees for the current step. */
function HostOnlyPanel({ hostOnly }: { hostOnly: QuizPreviewHostOnly }) {
  const entries = [
    { label: 'Round note', text: hostOnly.roundNote },
    { label: 'Question notes', text: hostOnly.questionNote },
  ].filter((entry) => entry.text !== null);
  return (
    <aside
      aria-label="Host only"
      className="flex shrink-0 flex-col gap-2 rounded-xl border-2 border-cyan p-3 text-xs"
    >
      <h2 className="font-extrabold uppercase tracking-wide text-cyan">
        Host only
      </h2>
      {entries.length === 0 ? (
        <p className="text-background/70">Nothing host-only on this screen.</p>
      ) : (
        entries.map((entry) => (
          <div key={entry.label} className="flex flex-col gap-0.5">
            <h3 className="font-bold text-background/70">{entry.label}</h3>
            <p className="whitespace-pre-wrap wrap-break-word">{entry.text}</p>
          </div>
        ))
      )}
    </aside>
  );
}

const MODE_LABELS: Record<QuizPreviewMode, string> = {
  answer_after_question: 'Question → answer',
  night: 'Like the night',
};

function ModeToggle({
  mode,
  onModeChange,
}: {
  mode: QuizPreviewMode;
  onModeChange: (mode: QuizPreviewMode) => void;
}) {
  return (
    <div className="flex gap-2">
      {QUIZ_PREVIEW_MODES.map((option) => (
        <Button
          key={option}
          type="button"
          size="md"
          aria-pressed={mode === option}
          onClick={() => onModeChange(option)}
          className={`rounded-xl border-2 border-background/50 text-xs font-extrabold ${
            mode === option ? 'bg-background text-foreground' : ''
          }`}
        >
          {MODE_LABELS[option]}
        </Button>
      ))}
    </div>
  );
}

function PreviewStepper({
  preview,
  mode,
  withJokers,
  initialAt,
  onPositionChange,
  onModeChange,
  onJokersChange,
}: {
  preview: QuizPreviewPayload;
  mode: QuizPreviewMode;
  withJokers: boolean;
  /** The `?at=` the page opened with; an unknown one means the first step. */
  initialAt: string | null;
  /** Called with the new step's position, or null on the first step. */
  onPositionChange: (at: string | null) => void;
  /** Called with the chosen order and the current position, which the new order keeps if it has it. */
  onModeChange: (mode: QuizPreviewMode, at: string | null) => void;
  /** Called with the chosen joker switch and the current position, which the new steps keep if they have it. */
  onJokersChange: (withJokers: boolean, at: string | null) => void;
}) {
  const { steps, quiz } = preview;
  const [index, setIndex] = useState(() => stepIndexAt(steps, initialAt));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastIndex = steps.length - 1;
  const positionAt = (stepIndex: number) =>
    stepIndex === 0 ? null : stepPosition(steps[stepIndex]);

  function goTo(target: number) {
    const next = Math.min(Math.max(target, 0), lastIndex);
    if (next === index) return;
    setIndex(next);
    onPositionChange(positionAt(next));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') goTo(index + 1);
      else if (event.key === 'ArrowLeft') goTo(index - 1);
      else if (event.key === 'Escape') setIsFullscreen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

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
    <main
      className={`flex h-dvh flex-col gap-3 bg-foreground text-background ${
        isFullscreen ? 'fixed inset-0 z-50 p-0' : 'p-4'
      }`}
    >
      {!isFullscreen && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="md"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="rounded-xl border-2 border-background/50 text-xs font-extrabold disabled:opacity-50"
          >
            Prev
          </Button>
          <Button
            type="button"
            size="md"
            onClick={() => goTo(index + 1)}
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
          <div className="ml-auto flex items-center gap-4">
            {mode === 'night' && (
              <label className="flex items-center gap-2 text-xs font-extrabold">
                <input
                  type="checkbox"
                  checked={withJokers}
                  onChange={(event) =>
                    onJokersChange(event.target.checked, positionAt(index))
                  }
                />
                With jokers
              </label>
            )}
            <ModeToggle
              mode={mode}
              onModeChange={(next) => onModeChange(next, positionAt(index))}
            />
          </div>
          <Button
            type="button"
            size="md"
            onClick={() => setIsFullscreen(true)}
            className="rounded-xl border-2 border-background/50 text-xs font-extrabold"
          >
            Fullscreen
          </Button>
        </div>
      )}
      <div className={`flex min-h-0 flex-1 ${isFullscreen ? '' : 'gap-3'}`}>
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <div
            className="flex aspect-video max-h-full max-w-full flex-col overflow-hidden bg-background text-foreground"
            style={{
              height: '100%',
              maxWidth: isFullscreen
                ? 'calc(100dvh * 16 / 9)'
                : 'calc((100dvh - 6rem) * 16 / 9)',
            }}
            data-testid="preview-frame"
          >
            {/* Keyed per step like /display's screenKey, so a reveal's entrances start fresh instead of carrying the last step's state. */}
            <DisplayScreenView key={index} screen={step.screen} quiz={quiz} />
          </div>
        </div>
        {!isFullscreen && (
          <div className="flex w-64 shrink-0 flex-col gap-3">
            <HostOnlyPanel hostOnly={step.hostOnly} />
            <JumpList steps={steps} currentIndex={index} onJump={goTo} />
          </div>
        )}
      </div>
    </main>
  );
}
