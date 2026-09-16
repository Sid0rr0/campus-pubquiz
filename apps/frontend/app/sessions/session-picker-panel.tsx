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
import { Dialog, DropdownMenu, Tabs } from 'radix-ui';
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cross2Icon,
  DotsVerticalIcon,
  ExternalLinkIcon,
  Pencil1Icon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import {
  DEFAULT_KAHOOT_QUESTION_TIMER_SECONDS,
  DEFAULT_SESSION_SETTINGS,
  type ActiveSessionSummary,
  type QuizSummary,
  type QuizzesListedPayload,
  type SessionSettings,
} from '@campus-pubquiz/types';
import { useAuth } from '@/app/lib/use-auth';
import { deleteQuiz, fetchQuizzes, QuizApiError } from '@/app/lib/quiz-api';
import {
  closeSession,
  createSession,
  fetchSessions,
  SessionApiError,
} from '@/app/lib/sessions-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { Button } from '@/app/components/button';
import { ConfirmDialog } from '@/app/components/confirm-dialog';
import { RoundsList } from '@/app/components/rounds-list';
import { SessionSettingsForm } from '@/app/components/session-settings-form';
import { CopyButton } from '@/app/components/copy-button';

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
  const [settings, setSettings] = useState<SessionSettings>(
    DEFAULT_SESSION_SETTINGS,
  );
  // Resets the settings form back to defaults whenever a different (or no)
  // quiz becomes pending — adjusted during render rather than in an Effect,
  // same pattern AdminPageContent uses for its own pendingQuizId-driven reset.
  const [prevPendingQuizId, setPrevPendingQuizId] = useState(pendingQuizId);
  const pendingQuiz = quizzes.find((quiz) => quiz.id === pendingQuizId) ?? null;
  if (pendingQuizId !== prevPendingQuizId) {
    setPrevPendingQuizId(pendingQuizId);
    setSettings({
      ...DEFAULT_SESSION_SETTINGS,
      kahootQuestionTimerSeconds: pendingQuiz?.rounds.some(
        (round) => round.kahootMode,
      )
        ? DEFAULT_KAHOOT_QUESTION_TIMER_SECONDS
        : null,
    });
  }

  const createMutation = useMutation({
    mutationFn: (variables: { quizId: number; settings: SessionSettings }) =>
      createSession(variables.quizId, variables.settings),
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      onOpenSession(session.joinCode);
    },
    onError: (createError) =>
      toast.error(
        apiErrorMessage(
          createError,
          SessionApiError,
          'Could not start session',
        ) ?? 'Could not start session',
      ),
    onSettled: () => setPendingQuizId(null),
  });

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

  function handleConfirmCreate(): void {
    if (pendingQuizId === null) return;
    createMutation.mutate({ quizId: pendingQuizId, settings });
  }

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
                  disabled={createMutation.isPending}
                  variant="solid-flat"
                  onClick={() => setPendingQuizId(quiz.id)}
                  className="flex min-h-8 items-center gap-1.5 px-4 disabled:opacity-40"
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
    [createMutation.isPending, isAdmin],
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
                    <CopyButton value={session.joinCode} />· Started{' '}
                    {new Date(session.startedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex shrink-0 gap-2">
                  {session.status === 'ended' && (
                    <Button
                      type="button"
                      variant="outline-muted"
                      size="md"
                      onClick={() => handleClose(session.joinCode)}
                    >
                      <Cross2Icon aria-hidden="true" />
                      Close
                    </Button>
                  )}
                  <Link
                    href={`/remote?code=${session.joinCode}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-10 items-center gap-1.5 rounded-lg border-2 border-foreground/30 px-4 text-sm font-extrabold"
                  >
                    <ExternalLinkIcon aria-hidden="true" />
                    Remote
                  </Link>
                  <Button
                    type="button"
                    variant="solid-flat"
                    size="md"
                    onClick={() => onOpenSession(session.joinCode)}
                  >
                    <ArrowRightIcon aria-hidden="true" />
                    Control
                  </Button>
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
          {quizzes.length === 0 ? (
            <p className="text-sm text-foreground/55">No quizzes yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-foreground/15">
              <table className="w-full border-collapse text-left">
                <thead>
                  {quizTable.getHeaderGroups().map((headerGroup) => (
                    <tr
                      key={headerGroup.id}
                      className="border-b border-foreground/15 bg-foreground/5"
                    >
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-4 py-2 font-display text-sm text-foreground/70"
                        >
                          {header.isPlaceholder ? null : header.column.getCanSort() ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="flex items-center gap-1"
                            >
                              <quizTable.FlexRender header={header} />
                              {header.column.getIsSorted() === 'asc' && (
                                <ChevronUpIcon aria-hidden="true" />
                              )}
                              {header.column.getIsSorted() === 'desc' && (
                                <ChevronDownIcon aria-hidden="true" />
                              )}
                            </button>
                          ) : (
                            <quizTable.FlexRender header={header} />
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {quizTable.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-foreground/10 last:border-b-0"
                    >
                      {row.getAllCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-2">
                          <quizTable.FlexRender cell={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <Dialog.Root
        open={pendingQuizId !== null}
        onOpenChange={(open) => {
          if (!open && !createMutation.isPending) setPendingQuizId(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-30 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-40 flex max-h-[85vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl bg-white p-5">
            <Dialog.Title className="font-display text-xl">
              Start &quot;{pendingQuiz?.title}&quot;?
            </Dialog.Title>
            <Tabs.Root defaultValue="overview" className="flex flex-col gap-3">
              <Tabs.List className="flex gap-1 border-b border-foreground/15">
                <Tabs.Trigger
                  value="overview"
                  className="min-h-10 border-b-2 border-transparent px-3 text-sm font-extrabold text-foreground/55 data-[state=active]:border-magenta data-[state=active]:text-foreground"
                >
                  Overview
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="settings"
                  className="min-h-10 border-b-2 border-transparent px-3 text-sm font-extrabold text-foreground/55 data-[state=active]:border-magenta data-[state=active]:text-foreground"
                >
                  Settings
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="overview">
                {pendingQuiz && <RoundsList rounds={pendingQuiz.rounds} />}
              </Tabs.Content>
              <Tabs.Content value="settings">
                <SessionSettingsForm value={settings} onChange={setSettings} />
              </Tabs.Content>
            </Tabs.Root>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                disabled={createMutation.isPending}
                variant="outline-muted"
                size="md"
                onClick={() => setPendingQuizId(null)}
              >
                <Cross2Icon aria-hidden="true" />
                Cancel
              </Button>
              <Button
                type="button"
                disabled={createMutation.isPending}
                variant="solid-flat"
                size="md"
                onClick={() => handleConfirmCreate()}
                className="disabled:opacity-40"
              >
                <CheckIcon aria-hidden="true" />
                {createMutation.isPending ? 'Starting…' : 'Confirm'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
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
