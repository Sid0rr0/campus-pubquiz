'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowRightIcon,
  CheckIcon,
  Cross2Icon,
  Pencil1Icon,
  PlayIcon,
  PlusIcon,
} from '@radix-ui/react-icons';
import {
  DEFAULT_SESSION_SETTINGS,
  type ActiveSessionSummary,
  type QuizzesListedPayload,
  type SessionSettings,
} from '@campus-pubquiz/types';
import { fetchQuizzes, QuizApiError } from '@/app/lib/quiz-api';
import {
  closeSession,
  createSession,
  fetchSessions,
  SessionApiError,
} from '@/app/lib/sessions-api';
import { RoundsList } from '@/app/components/rounds-list';
import { SessionSettingsForm } from '@/app/components/session-settings-form';
import { CopyButton } from '@/app/components/copy-button';

interface SessionPickerPanelProps {
  /** Navigates the browser into the console for a specific session's code — owned by the page since only it holds the router. */
  onOpenSession: (joinCode: string) => void;
}

/** Landing screen shown when the admin hasn't pinned a specific session via `?code=` yet — lists every session currently running in the process and offers to start a new one. */
export function SessionPickerPanel({ onOpenSession }: SessionPickerPanelProps) {
  const [sessions, setSessions] = useState<ActiveSessionSummary[]>([]);
  const [quizzes, setQuizzes] = useState<QuizzesListedPayload['quizzes']>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingQuizId, setPendingQuizId] = useState<number | null>(null);
  const [settings, setSettings] = useState<SessionSettings>(
    DEFAULT_SESSION_SETTINGS,
  );
  // Resets the settings form back to defaults whenever a different (or no)
  // quiz becomes pending — adjusted during render rather than in an Effect,
  // same pattern AdminPageContent uses for its own pendingQuizId-driven reset.
  const [prevPendingQuizId, setPrevPendingQuizId] = useState(pendingQuizId);
  if (pendingQuizId !== prevPendingQuizId) {
    setPrevPendingQuizId(pendingQuizId);
    setSettings(DEFAULT_SESSION_SETTINGS);
  }
  // Guards state updates from requests that resolve after this panel has
  // unmounted (e.g. the admin clicks "Open" on a session before the initial
  // refresh finishes) — skips the update instead of setting state on a
  // component nothing is rendering anymore.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    fetchSessions()
      .then((result) => {
        if (!isMountedRef.current) return;
        setSessions(result);
        setError(null);
      })
      .catch((fetchError: unknown) => {
        if (!isMountedRef.current) return;
        setError(
          fetchError instanceof SessionApiError
            ? fetchError.message
            : 'Could not load sessions',
        );
      });
    fetchQuizzes()
      .then((result) => {
        if (!isMountedRef.current) return;
        setQuizzes(result.quizzes);
      })
      .catch((fetchError: unknown) => {
        if (!isMountedRef.current) return;
        setError(
          fetchError instanceof QuizApiError
            ? fetchError.message
            : 'Could not load quizzes',
        );
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pendingQuiz = quizzes.find((quiz) => quiz.id === pendingQuizId) ?? null;

  async function handleConfirmCreate() {
    if (pendingQuizId === null) return;
    setIsCreating(true);
    try {
      const session = await createSession(pendingQuizId, settings);
      onOpenSession(session.joinCode);
    } catch (createError) {
      if (!isMountedRef.current) return;
      toast.error(
        createError instanceof SessionApiError
          ? createError.message
          : 'Could not start session',
      );
    } finally {
      if (isMountedRef.current) {
        setIsCreating(false);
        setPendingQuizId(null);
      }
    }
  }

  async function handleClose(joinCode: string) {
    try {
      await closeSession(joinCode);
      refresh();
    } catch (closeError) {
      if (!isMountedRef.current) return;
      toast.error(
        closeError instanceof SessionApiError
          ? closeError.message
          : 'Could not close session',
      );
    }
  }

  return (
    <main className="flex min-h-screen justify-center w-full gap-6 bg-background p-6 text-foreground">
      <div className="flex flex-col max-w-4xl gap-3">
        <h1 className="font-display text-2xl">Quiz Sessions</h1>
        {error && (
          <p role="alert" className="font-extrabold text-magenta">
            {error}
          </p>
        )}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl">Running Sessions</h2>
          {sessions.length === 0 && (
            <p className="text-sm text-foreground/55">
              No sessions running yet.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {sessions.map((session) => (
              <li
                key={session.joinCode}
                className="flex items-center justify-between gap-3 rounded-xl border border-foreground/15 bg-white px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="font-extrabold">{session.quizTitle}</span>
                  <span className="flex items-center gap-1 text-xs text-foreground/55">
                    {session.status} · {session.teamCount} teams ·{' '}
                    {session.joinCode}
                    <CopyButton value={session.joinCode} />
                  </span>
                </div>
                <div className="flex shrink-0 gap-2">
                  {session.status === 'ended' && (
                    <button
                      type="button"
                      onClick={() => void handleClose(session.joinCode)}
                      className="flex min-h-10 items-center gap-1.5 rounded-lg border-2 border-foreground/30 px-4 text-sm font-extrabold"
                    >
                      <Cross2Icon aria-hidden="true" />
                      Close
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenSession(session.joinCode)}
                    className="flex min-h-10 items-center gap-1.5 rounded-lg bg-magenta px-4 text-sm font-extrabold text-white"
                  >
                    <ArrowRightIcon aria-hidden="true" />
                    Open
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl">Start a New Session</h2>
            <Link
              href="/quizzes/new"
              className="min-h-10 rounded-lg bg-magenta px-4 text-sm font-extrabold text-white flex items-center gap-1.5"
            >
              <PlusIcon aria-hidden="true" />
              New Quiz
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {quizzes.map((quiz) => (
              <li
                key={quiz.id}
                className="flex items-center gap-2 min-h-11 flex-1 justify-between rounded-xl border border-foreground/15 bg-white px-4 font-extrabold "
              >
                <span>
                  {quiz.title} ({quiz.rounds.length} rounds |{' '}
                  {quiz.rounds.reduce(
                    (sum, round) => sum + round.questions.length,
                    0,
                  )}{' '}
                  total questions)
                </span>

                <div className="flex gap-2">
                  <Link
                    href={`/quizzes/${quiz.id}`}
                    className="flex min-h-8 shrink-0 items-center gap-1 rounded-xl border border-foreground/30 px-2 text-sm font-bold"
                  >
                    <Pencil1Icon aria-hidden="true" />
                    Edit
                  </Link>

                  <button
                    disabled={isCreating}
                    onClick={() => setPendingQuizId(quiz.id)}
                    className="flex min-h-8 items-center gap-1.5 rounded-lg bg-magenta px-4 text-sm font-extrabold text-white disabled:opacity-40"
                  >
                    <PlayIcon aria-hidden="true" />
                    Start
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <Dialog.Root
        open={pendingQuizId !== null}
        onOpenChange={(open) => {
          if (!open && !isCreating) setPendingQuizId(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-30 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-40 flex max-h-[85vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl bg-white p-5">
            <Dialog.Title className="font-display text-xl">
              Start &quot;{pendingQuiz?.title}&quot;?
            </Dialog.Title>
            {pendingQuiz && <RoundsList rounds={pendingQuiz.rounds} />}
            <SessionSettingsForm value={settings} onChange={setSettings} />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isCreating}
                onClick={() => setPendingQuizId(null)}
                className="flex min-h-10 items-center gap-1.5 rounded-lg border-2 border-foreground/30 px-4 text-sm font-extrabold disabled:opacity-40"
              >
                <Cross2Icon aria-hidden="true" />
                Cancel
              </button>
              <button
                type="button"
                disabled={isCreating}
                onClick={() => void handleConfirmCreate()}
                className="flex min-h-10 items-center gap-1.5 rounded-lg bg-magenta px-4 text-sm font-extrabold text-white disabled:opacity-40"
              >
                <CheckIcon aria-hidden="true" />
                {isCreating ? 'Starting…' : 'Confirm'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
