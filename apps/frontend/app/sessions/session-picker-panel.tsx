'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  tableFeatures,
  useTable,
  type SortingState,
} from '@tanstack/react-table';
import Link from 'next/link';
import { toast } from 'sonner';
import { DropdownMenu } from 'radix-ui';
import {
  DotsVerticalIcon,
  Pencil1Icon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import {
  type ActiveSessionSummary,
  type QuizSummary,
  type QuizzesListedPayload,
} from '@campus-pubquiz/types';
import { useAuth } from '@/app/lib/use-auth';
import { deleteQuiz, fetchQuizzes, QuizApiError } from '@/app/lib/quiz-api';
import {
  closeSession,
  fetchSessions,
  SessionApiError,
} from '@/app/lib/sessions-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { Button } from '@/app/components/button';
import { ConfirmDialog } from '@/app/components/confirm-dialog';
import { StartSessionDialog } from '@/app/components/start-session-dialog';
import { RunningSessionsList } from '@/app/components/running-sessions-list';
import { SortableTable } from '@/app/components/sortable-table';

const quizTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
const quizColumnHelper = createColumnHelper<
  typeof quizTableFeatures,
  QuizSummary
>();

const EMPTY_SESSIONS: ActiveSessionSummary[] = [];
const EMPTY_QUIZZES: QuizzesListedPayload['quizzes'] = [];

interface SessionPickerPanelProps {
  /** Navigates the browser into the console for a specific session's code — owned by the page since only it holds the router. */
  onOpenSession: (joinCode: string) => void;
}

/** Landing screen shown when the admin hasn't pinned a specific session via `?code=` yet — lists every session currently running in the process and offers to start a new one. */
export function SessionPickerPanel({ onOpenSession }: SessionPickerPanelProps) {
  const auth = useAuth();
  const isAdmin =
    auth.status === 'authenticated' && auth.user?.role === 'admin';
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery({
    queryKey: queryKeys.sessions.list(),
    queryFn: fetchSessions,
  });
  const quizzesQuery = useQuery({
    queryKey: queryKeys.quizzes.list(),
    queryFn: () => fetchQuizzes(),
  });
  const sessions = sessionsQuery.data ?? EMPTY_SESSIONS;
  const quizzes = quizzesQuery.data?.quizzes ?? EMPTY_QUIZZES;
  // Single alert slot, sessions first — matches the old shared `error` state,
  // where whichever fetch rejected last won it and the sessions fetch
  // cleared it on success.
  const error =
    apiErrorMessage(
      sessionsQuery.error,
      SessionApiError,
      'Could not load sessions',
    ) ??
    apiErrorMessage(quizzesQuery.error, QuizApiError, 'Could not load quizzes');

  const [pendingQuizId, setPendingQuizId] = useState<number | null>(null);
  const pendingQuiz = quizzes.find((quiz) => quiz.id === pendingQuizId) ?? null;

  const closeMutation = useMutation({
    mutationFn: (joinCode: string) => closeSession(joinCode),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all }),
    onError: (closeError) =>
      toast.error(
        apiErrorMessage(
          closeError,
          SessionApiError,
          'Could not close session',
        ) ?? 'Could not close session',
      ),
  });

  // Most-recently-edited quiz on top by default — the quiz an admin just
  // saved is the one they're about to start a session from.
  const [quizSorting, setQuizSorting] = useState<SortingState>([
    { id: 'updatedAt', desc: true },
  ]);

  const [deletingQuiz, setDeletingQuiz] = useState<QuizSummary | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (quizId: number) => deleteQuiz(quizId),
    onSuccess: () => {
      // Deleting a quiz cascades (at the DB level) to every game_session
      // ever run from it, including ended ones the Running Sessions list
      // still shows — refresh both lists, not just quizzes.
      void queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      setDeletingQuiz(null);
    },
    onError: (deleteError) =>
      toast.error(
        apiErrorMessage(deleteError, QuizApiError, 'Could not delete quiz') ??
          'Could not delete quiz',
      ),
  });

  function handleClose(joinCode: string): void {
    closeMutation.mutate(joinCode);
  }

  const quizColumns = useMemo(
    () =>
      quizColumnHelper.columns([
        quizColumnHelper.accessor('title', {
          header: 'Quiz',
          sortFn: sortFn_alphanumeric,
          cell: (context) => {
            const quiz = context.row.original;
            const questionCount = quiz.rounds.reduce(
              (sum, round) => sum + round.questions.length,
              0,
            );
            return (
              <span className="font-extrabold">
                {quiz.title} ({quiz.rounds.length} rounds | {questionCount}{' '}
                total questions)
              </span>
            );
          },
        }),
        quizColumnHelper.accessor('updatedAt', {
          header: 'Edited',
          sortFn: sortFn_datetime,
          cell: (context) => new Date(context.getValue()).toLocaleString(),
        }),
        quizColumnHelper.display({
          id: 'actions',
          header: 'Actions',
          cell: (context) => {
            const quiz = context.row.original;
            return (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="solid-flat"
                  onClick={() => setPendingQuizId(quiz.id)}
                  className="flex min-h-8 items-center gap-1.5 px-4"
                >
                  <PlayIcon aria-hidden="true" />
                  Start
                </Button>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <Button
                      type="button"
                      size="icon-md"
                      aria-label={`Actions for ${quiz.title}`}
                      className="rounded-lg border-2 border-foreground/15 text-foreground/70"
                    >
                      <DotsVerticalIcon aria-hidden="true" />
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      className="z-40 flex min-w-40 flex-col gap-0.5 rounded-lg border-2 border-foreground/15 bg-background p-1 shadow-lg"
                    >
                      <DropdownMenu.Item asChild>
                        <Link
                          href={`/quizzes/${quiz.id}`}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-bold text-foreground outline-none data-highlighted:bg-foreground/10"
                        >
                          <Pencil1Icon aria-hidden="true" />
                          Edit
                        </Link>
                      </DropdownMenu.Item>
                      {isAdmin && (
                        <DropdownMenu.Item
                          onSelect={() => setDeletingQuiz(quiz)}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-bold text-magenta outline-none data-highlighted:bg-magenta/10"
                        >
                          <TrashIcon aria-hidden="true" />
                          Delete
                        </DropdownMenu.Item>
                      )}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            );
          },
        }),
      ]),
    [isAdmin],
  );

  const quizTable = useTable({
    features: quizTableFeatures,
    columns: quizColumns,
    data: quizzes,
    getRowId: (quiz) => String(quiz.id),
    // Without this, the toggle cycle is desc -> unsorted -> asc: on the
    // "unsorted" click, sorting[0] becomes undefined and the table falls
    // back to insertion order instead of a real sort. Locking the cycle to
    // asc <-> desc keeps every click a distinct sort and never silently
    // drops the most-recently-edited-first default.
    enableSortingRemoval: false,
    state: { sorting: quizSorting },
    onSortingChange: setQuizSorting,
  });

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
          <RunningSessionsList
            sessions={sessions}
            onClose={handleClose}
            onOpenSession={onOpenSession}
          />
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
          {quizzes.length === 0 ? (
            <p className="text-sm text-foreground/55">No quizzes yet.</p>
          ) : (
            <SortableTable table={quizTable} />
          )}
        </section>
      </div>
      <StartSessionDialog
        quiz={pendingQuiz}
        onClose={() => setPendingQuizId(null)}
        onCreated={onOpenSession}
      />
      <ConfirmDialog
        open={deletingQuiz !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeletingQuiz(null);
        }}
        title={`Delete "${deletingQuiz?.title}"?`}
        description="This permanently deletes the quiz, including every session ever run from it. This can't be undone."
        confirmLabel={deleteMutation.isPending ? 'Deleting…' : 'Delete'}
        onConfirm={() => {
          if (!deletingQuiz) return;
          const { title } = deletingQuiz;
          deleteMutation.mutate(deletingQuiz.id, {
            onSuccess: () => toast.success(`Deleted "${title}"`),
          });
        }}
      />
    </main>
  );
}
