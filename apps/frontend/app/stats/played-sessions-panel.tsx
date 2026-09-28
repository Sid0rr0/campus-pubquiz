'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import type { PlayedSessionStats } from '@campus-pubquiz/types';
import {
  deleteSession,
  fetchPlayedSessions,
  StatsApiError,
} from '@/app/lib/stats-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { useAuth } from '@/app/lib/use-auth';
import { Button } from '@/app/components/button';
import { ConfirmDialog } from '@/app/components/confirm-dialog';

const PAGE_SIZE = 20;

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});
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

  const statsQuery = useQuery({
    queryKey: queryKeys.stats.sessions(),
    queryFn: ({ signal }) => fetchPlayedSessions(signal),
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

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('quizTitle', {
          header: 'Quiz',
          sortFn: sortFn_alphanumeric,
          cell: (context) => (
            <Link
              href={`/stats/${context.row.original.gameSessionId}`}
              className="underline-offset-2 hover:underline"
            >
              {context.getValue()}
            </Link>
          ),
        }),
        helper.accessor('playedAt', {
          header: 'Date',
          sortFn: sortFn_datetime,
          cell: (context) => new Date(context.getValue()).toLocaleDateString(),
        }),
        helper.accessor('teamCount', {
          header: 'Teams',
          sortFn: sortFn_basic,
        }),
        helper.accessor('maxPoints', {
          header: 'Max points',
          sortFn: sortFn_basic,
        }),
        // Sorts on the winner's answer points (nulls — no teams joined — last).
        helper.accessor((session) => session.winnerAnswerPoints ?? -1, {
          id: 'winner',
          header: 'Winner points',
          sortFn: sortFn_basic,
          cell: (context) => {
            const session = context.row.original;
            return session.winnerTeamName === null ||
              session.winnerAnswerPoints === null
              ? '—'
              : `${session.winnerAnswerPoints} — ${session.winnerTeamName}`;
          },
        }),
        ...(isAdmin
          ? [
              helper.display({
                id: 'actions',
                header: 'Actions',
                cell: (context) => (
                  <Button
                    type="button"
                    variant="outline-muted"
                    size="sm"
                    aria-label={`Delete ${context.row.original.quizTitle}`}
                    onClick={() => setDeletingSession(context.row.original)}
                    className="text-magenta"
                  >
                    <TrashIcon aria-hidden="true" />
                    Delete
                  </Button>
                ),
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
    data: payload ?? [],
    getRowId: (session) => String(session.gameSessionId),
    // Locks the toggle cycle to asc <-> desc (skipping "unsorted") so the
    // most-recent-first default is never silently lost on a stray click.
    enableSortingRemoval: false,
    state: { sorting, pagination },
    onSortingChange: handleSortingChange,
    onPaginationChange: setPagination,
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
        title={`Delete "${deletingSession?.quizTitle}"?`}
        description="This permanently deletes this session's stats, including every answer and bonus award recorded for it. This can't be undone."
        confirmLabel={deleteMutation.isPending ? 'Deleting…' : 'Delete'}
        onConfirm={() => {
          if (!deletingSession) return;
          deleteMutation.mutate(deletingSession.gameSessionId, {
            onSuccess: () =>
              toast.success(`Deleted "${deletingSession.quizTitle}"`),
          });
        }}
      />
    </main>
  );
}
