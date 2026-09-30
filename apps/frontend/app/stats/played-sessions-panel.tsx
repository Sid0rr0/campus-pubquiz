'use client';

import { useMemo, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import Link from 'next/link';
import { toast } from 'sonner';
import { Dialog, DropdownMenu } from 'radix-ui';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cross2Icon,
  DotsVerticalIcon,
  Pencil1Icon,
  TrashIcon,
} from '@radix-ui/react-icons';
import type {
  PlayedSessionStats,
  PlayedSessionsSortColumn,
  PlayedSessionsSortOrder,
} from '@campus-pubquiz/types';
import {
  deleteSession,
  fetchPlayedSessions,
  renameSession,
  StatsApiError,
} from '@/app/lib/stats-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { useAuth } from '@/app/lib/use-auth';
import { Button } from '@/app/components/button';
import { ConfirmDialog } from '@/app/components/confirm-dialog';

const PAGE_SIZE = 20;

const features = tableFeatures({ rowSortingFeature, rowPaginationFeature });
const helper = createColumnHelper<typeof features, PlayedSessionStats>();

export function PlayedSessionsPanel() {
  const auth = useAuth();
  const isAdmin =
    auth.status === 'authenticated' && auth.user?.role === 'admin';
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'playedAt', desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [deletingSession, setDeletingSession] =
    useState<PlayedSessionStats | null>(null);
  const [renamingSession, setRenamingSession] =
    useState<PlayedSessionStats | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const sortBy = (sorting[0]?.id ?? 'playedAt') as PlayedSessionsSortColumn;
  const sortOrder: PlayedSessionsSortOrder = sorting[0]
    ? sorting[0].desc
      ? 'desc'
      : 'asc'
    : 'desc';
  const params = {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortOrder,
  };

  const statsQuery = useQuery({
    queryKey: queryKeys.stats.sessions(params),
    queryFn: ({ signal }) => fetchPlayedSessions(params, signal),
    placeholderData: keepPreviousData,
  });
  const payload = statsQuery.data ?? null;
  const error = apiErrorMessage(
    statsQuery.error,
    StatsApiError,
    'Could not load session stats',
  );

  const deleteMutation = useMutation({
    mutationFn: (gameSessionId: number) => deleteSession(gameSessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      setDeletingSession(null);
    },
    onError: (deleteError) =>
      toast.error(
        apiErrorMessage(
          deleteError,
          StatsApiError,
          'Could not delete session',
        ) ?? 'Could not delete session',
      ),
  });

  const renameMutation = useMutation({
    mutationFn: (variables: { gameSessionId: number; name: string }) =>
      renameSession(variables.gameSessionId, variables.name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
      setRenamingSession(null);
    },
    onError: (renameError) =>
      toast.error(
        apiErrorMessage(
          renameError,
          StatsApiError,
          'Could not rename session',
        ) ?? 'Could not rename session',
      ),
  });

  const columns = useMemo(
    () =>
      helper.columns([
        // Sorted server-side on the resolved display name (custom name if
        // set, else the quiz title) — see StatsService.listPlayedSessions'
        // orderColumn.quizTitle.
        helper.accessor('quizTitle', {
          header: 'Session',
          cell: (context) => (
            <Link
              href={`/stats/${context.row.original.gameSessionId}`}
              className="underline-offset-2 hover:underline"
            >
              {context.row.original.name}
            </Link>
          ),
        }),
        helper.accessor('playedAt', {
          header: 'Date',
          cell: (context) => new Date(context.getValue()).toLocaleDateString(),
        }),
        helper.accessor('teamCount', { header: 'Teams' }),
        helper.accessor('maxPoints', { header: 'Max points' }),
        // Sorted server-side on the winner's total points (nulls — no teams
        // on the roster — last); see PlayedSessionsSortColumn 'winner'.
        helper.accessor((session) => session.winnerPoints ?? -1, {
          id: 'winner',
          header: 'Winner points',
          cell: (context) => {
            const session = context.row.original;
            return session.winnerTeamName === null ||
              session.winnerPoints === null
              ? '—'
              : `${session.winnerPoints} — ${session.winnerTeamName}`;
          },
        }),
        ...(isAdmin
          ? [
              helper.display({
                id: 'actions',
                header: 'Actions',
                cell: (context) => {
                  const session = context.row.original;
                  return (
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <Button
                          type="button"
                          size="icon-md"
                          aria-label={`Actions for ${session.name}`}
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
                          <DropdownMenu.Item
                            onSelect={() => {
                              setRenamingSession(session);
                              setRenameValue(session.name);
                            }}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-bold text-foreground outline-none data-highlighted:bg-foreground/10"
                          >
                            <Pencil1Icon aria-hidden="true" />
                            Edit
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            onSelect={() => setDeletingSession(session)}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-bold text-magenta outline-none data-highlighted:bg-magenta/10"
                          >
                            <TrashIcon aria-hidden="true" />
                            Delete
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  );
                },
              }),
            ]
          : []),
      ]),
    [isAdmin],
  );

  function handleSortingChange(updater: Updater<SortingState>): void {
    setSorting(updater);
    // A new sort reorders the entire dataset, not just the visible page, so
    // staying on the old pageIndex would show an arbitrary slice — reset to
    // page 1 instead.
    setPagination((old) => ({ ...old, pageIndex: 0 }));
  }

  const table = useTable({
    features,
    columns,
    data: payload?.items ?? [],
    getRowId: (session) => String(session.gameSessionId),
    manualSorting: true,
    manualPagination: true,
    enableMultiSort: false,
    // Locks the toggle cycle to asc <-> desc (skipping "unsorted") so the
    // most-recent-first default is never silently lost on a stray click, and
    // so a click always produces a distinct sort the query will refetch for
    // (see teams-directory-panel's identical reasoning).
    enableSortingRemoval: false,
    state: { sorting, pagination },
    onSortingChange: handleSortingChange,
    onPaginationChange: setPagination,
    rowCount: payload?.total ?? 0,
  });

  if (!payload) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        {error ? (
          <p role="alert" className="font-extrabold text-magenta">
            {error}
          </p>
        ) : (
          <p className="font-display text-xl">Loading…</p>
        )}
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-background p-6 text-foreground">
      <h1 className="font-display text-2xl">Stats</h1>
      {error && (
        <p role="alert" className="font-extrabold text-magenta">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-foreground/15">
        <table className="w-full border-collapse text-left">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
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
                        <table.FlexRender header={header} />
                        {header.column.getIsSorted() === 'asc' && (
                          <ChevronUpIcon aria-hidden="true" />
                        )}
                        {header.column.getIsSorted() === 'desc' && (
                          <ChevronDownIcon aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-3 text-center text-foreground/50"
                >
                  No finished sessions yet.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-foreground/10 last:border-b-0"
                >
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline-muted"
          size="sm"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
        >
          Prev
        </Button>
        <span className="text-sm text-foreground/60">
          Page {pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <Button
          type="button"
          variant="outline-muted"
          size="sm"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
        >
          Next
        </Button>
      </div>
      <ConfirmDialog
        open={deletingSession !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeletingSession(null);
        }}
        title={`Delete "${deletingSession?.name}"?`}
        description="This permanently deletes this session's stats, including every answer and bonus award recorded for it. This can't be undone."
        confirmLabel={deleteMutation.isPending ? 'Deleting…' : 'Delete'}
        onConfirm={() => {
          if (!deletingSession) return;
          deleteMutation.mutate(deletingSession.gameSessionId, {
            onSuccess: () => toast.success(`Deleted "${deletingSession.name}"`),
          });
        }}
      />
      <Dialog.Root
        open={renamingSession !== null}
        onOpenChange={(open) => {
          if (!open && !renameMutation.isPending) setRenamingSession(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-30 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-40 flex w-full max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl bg-white p-5">
            <Dialog.Title className="font-display text-lg">
              Rename session
            </Dialog.Title>
            <label className="flex flex-col gap-1 text-sm font-extrabold">
              Session name
              <input
                type="text"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                placeholder={renamingSession?.quizTitle}
                className="min-h-10 rounded-lg border border-foreground/20 px-3 text-sm font-normal"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                disabled={renameMutation.isPending}
                variant="outline-muted"
                size="sm"
                onClick={() => setRenamingSession(null)}
              >
                <Cross2Icon aria-hidden="true" />
                Cancel
              </Button>
              <Button
                type="button"
                disabled={renameMutation.isPending}
                variant="solid-flat"
                size="sm"
                onClick={() => {
                  if (!renamingSession) return;
                  renameMutation.mutate({
                    gameSessionId: renamingSession.gameSessionId,
                    name: renameValue,
                  });
                }}
              >
                <CheckIcon aria-hidden="true" />
                {renameMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
