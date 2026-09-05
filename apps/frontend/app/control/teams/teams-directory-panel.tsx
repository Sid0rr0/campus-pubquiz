'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import type {
  PaginationState,
  SortingState,
  Updater,
} from '@tanstack/react-table';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import type {
  TeamListItem,
  TeamsSortColumn,
  TeamsSortOrder,
} from '@campus-pubquiz/types';
import { fetchTeams, TeamsApiError } from '@/app/lib/teams-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { Button } from '@/app/components/button';

const features = tableFeatures({ rowSortingFeature, rowPaginationFeature });
const helper = createColumnHelper<typeof features, TeamListItem>();

const columns = helper.columns([
  helper.accessor('name', { header: 'Team', enableSorting: false }),
  helper.accessor('code', { header: 'Code', enableSorting: false }),
  helper.accessor('joinedAt', {
    header: 'Joined',
    cell: (ctx) => new Date(ctx.getValue()).toLocaleDateString(),
  }),
  helper.accessor('sessionsJoined', { header: 'Sessions played' }),
]);

export function TeamsDirectoryPanel() {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'joinedAt', desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const sortBy = (sorting[0]?.id ?? 'joinedAt') as TeamsSortColumn;
  const sortOrder: TeamsSortOrder = sorting[0]
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

  const teamsQuery = useQuery({
    queryKey: queryKeys.teams.list(params),
    queryFn: ({ signal }) => fetchTeams(params, signal),
    placeholderData: keepPreviousData,
  });
  const payload = teamsQuery.data ?? null;
  const error = apiErrorMessage(
    teamsQuery.error,
    TeamsApiError,
    'Could not load teams',
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
    getRowId: (team) => String(team.id),
    manualSorting: true,
    manualPagination: true,
    enableMultiSort: false,
    // Without this, the toggle cycle is desc -> unsorted -> asc: on the
    // "unsorted" click, sorting[0] becomes undefined and this component
    // falls back to the joinedAt/desc default — identical to the very first
    // fetch's params, so React Query serves the cached page instead of
    // refetching. Locking the cycle to asc <-> desc keeps every click a
    // real, distinct sort.
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
      <h1 className="font-display text-2xl">Teams</h1>
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
                  No teams have joined yet.
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
    </main>
  );
}
