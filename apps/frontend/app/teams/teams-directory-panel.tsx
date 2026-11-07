'use client';

import { useMemo, useState } from 'react';
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
import Link from 'next/link';
import { DotsVerticalIcon, EyeOpenIcon } from '@radix-ui/react-icons';
import { DropdownMenu } from 'radix-ui';
import { MAX_TEAMS_SEARCH_LENGTH } from '@campus-pubquiz/types';
import type {
  TeamListItem,
  TeamsSortColumn,
  TeamsSortOrder,
} from '@campus-pubquiz/types';
import { fetchTeams, TeamsApiError } from '@/app/lib/teams-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { Button } from '@/app/components/button';
import { SortableTable } from '@/app/components/sortable-table';
import { TeamCodeDialog } from '@/app/control/team-code-dialog';

const features = tableFeatures({ rowSortingFeature, rowPaginationFeature });
const helper = createColumnHelper<typeof features, TeamListItem>();

export function TeamsDirectoryPanel() {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'sessionsJoined', desc: true },
  ]);
  const [search, setSearch] = useState('');
  const [showQuickfireOnly, setShowQuickfireOnly] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [viewingCodeTeam, setViewingCodeTeam] = useState<TeamListItem | null>(
    null,
  );

  const columns = useMemo(() => teamsColumns(setViewingCodeTeam), []);

  // shortcut: one request per keystroke, debounce if /teams ever gets slow.
  const trimmedSearch = search.trim();
  const params = {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    ...sortParamsOf(sorting),
    search: trimmedSearch,
    showQuickfireOnly,
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
    data: payload?.items ?? NO_TEAMS,
    getRowId: (team) => String(team.id),
    manualSorting: true,
    manualPagination: true,
    enableMultiSort: false,
    // Without this, the toggle cycle is desc -> unsorted -> asc: on the
    // "unsorted" click, sorting[0] becomes undefined and this component
    // falls back to the sessionsJoined/desc default — identical to the very first
    // fetch's params, so React Query serves the cached page instead of
    // refetching. Locking the cycle to asc <-> desc keeps every click a
    // real, distinct sort.
    enableSortingRemoval: false,
    state: { sorting, pagination },
    onSortingChange: handleSortingChange,
    onPaginationChange: setPagination,
    rowCount: payload?.total ?? 0,
  });

  if (!payload) return <DirectoryLoading error={error} />;

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-background p-6 text-foreground">
      <h1 className="font-display text-2xl">Teams</h1>
      {error && (
        <p role="alert" className="font-extrabold text-magenta">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-6">
        <label className="flex max-w-sm flex-col gap-1 text-sm font-bold">
          Search teams
          <input
            type="search"
            value={search}
            maxLength={MAX_TEAMS_SEARCH_LENGTH}
            onChange={(event) => {
              setSearch(event.target.value);
              // The match count changes, so the current page may no longer exist.
              setPagination((old) => ({ ...old, pageIndex: 0 }));
            }}
            className="rounded-lg border-2 border-foreground/30 bg-transparent px-3 py-2 font-normal"
          />
        </label>
        <label className="flex items-center gap-2 py-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={showQuickfireOnly}
            onChange={(event) => {
              setShowQuickfireOnly(event.target.checked);
              setPagination((old) => ({ ...old, pageIndex: 0 }));
            }}
          />
          Show quickfire-only teams
        </label>
      </div>

      <SortableTable
        table={table}
        emptyMessage={emptyMessageFor(trimmedSearch)}
      />

      <DirectoryPager table={table} pageIndex={pagination.pageIndex} />
      <TeamCodeDialog
        open={viewingCodeTeam !== null}
        {...teamCodeOf(viewingCodeTeam)}
        onOpenChange={(open) => {
          if (!open) setViewingCodeTeam(null);
        }}
      />
    </main>
  );
}

function teamsColumns(onViewCode: (team: TeamListItem) => void) {
  return helper.columns([
    helper.accessor('name', {
      header: 'Team',
      enableSorting: false,
      cell: (ctx) => (
        <Link
          href={`/teams/${ctx.row.original.id}`}
          className="underline-offset-2 hover:underline"
        >
          {ctx.getValue()}
        </Link>
      ),
    }),
    helper.accessor('joinedAt', {
      header: 'Joined',
      cell: (ctx) => new Date(ctx.getValue()).toLocaleDateString(),
    }),
    helper.accessor('sessionsJoined', { header: 'Sessions played' }),
    helper.accessor('averagePlacing', {
      header: 'Avg. placing',
      cell: (ctx) => ctx.getValue()?.toFixed(1) ?? '—',
    }),
    helper.display({
      id: 'actions',
      header: 'Actions',
      cell: (context) => (
        <TeamActionsMenu team={context.row.original} onViewCode={onViewCode} />
      ),
    }),
  ]);
}

function TeamActionsMenu({
  team,
  onViewCode,
}: {
  team: TeamListItem;
  onViewCode: (team: TeamListItem) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          type="button"
          size="icon-md"
          aria-label={`Actions for ${team.name}`}
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
            onSelect={() => onViewCode(team)}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-bold text-foreground outline-none data-highlighted:bg-foreground/10"
          >
            <EyeOpenIcon aria-hidden="true" />
            Show team code
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** The query's sort, most sessions first until a column is picked. */
function sortParamsOf(sorting: SortingState): {
  sortBy: TeamsSortColumn;
  sortOrder: TeamsSortOrder;
} {
  const [first] = sorting;
  if (!first) return { sortBy: 'sessionsJoined', sortOrder: 'desc' };
  return {
    sortBy: first.id as TeamsSortColumn,
    sortOrder: first.desc ? 'desc' : 'asc',
  };
}

function teamCodeOf(team: TeamListItem | null) {
  return { teamName: team?.name ?? '', code: team?.code ?? null };
}

function DirectoryLoading({ error }: { error: string | null | undefined }) {
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

function DirectoryPager({
  table,
  pageIndex,
}: {
  table: {
    getCanPreviousPage: () => boolean;
    getCanNextPage: () => boolean;
    previousPage: () => void;
    nextPage: () => void;
    getPageCount: () => number;
  };
  pageIndex: number;
}) {
  return (
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
        Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
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
  );
}

const NO_TEAMS: TeamListItem[] = [];

function emptyMessageFor(search: string): string {
  return search ? 'No teams match.' : 'No teams have joined yet.';
}
