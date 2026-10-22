'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_basic,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import type { TeamSessionRow } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { SortableTable } from '@/app/components/sortable-table';
import { placingText } from '@/app/lib/placing-text';

const PAGE_SIZE = 10;

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});
const helper = createColumnHelper<typeof features, TeamSessionRow>();

function sharePercent(row: TeamSessionRow): number {
  // A joker can take a total past the quiz maximum: the share caps at 100%.
  return row.maxPoints > 0
    ? Math.min((row.totalPoints / row.maxPoints) * 100, 100)
    : 0;
}

const buildColumns = (
  onOpenSession: ((gameSessionId: number) => void) | undefined,
) =>
  helper.columns([
    helper.accessor((row) => new Date(row.playedAt).getTime(), {
      id: 'playedAt',
      header: 'Date',
      sortFn: sortFn_basic,
      cell: (context) =>
        new Date(context.row.original.playedAt).toLocaleDateString(),
    }),
    helper.accessor('name', {
      header: 'Session',
      cell: (context) => {
        if (onOpenSession) {
          return (
            <button
              type="button"
              onClick={() => onOpenSession(context.row.original.gameSessionId)}
              className="text-left underline-offset-2 hover:underline"
            >
              {context.getValue()}
            </button>
          );
        }
        return (
          <Link
            href={`/stats/${context.row.original.gameSessionId}`}
            className="underline-offset-2 hover:underline"
          >
            {context.getValue()}
          </Link>
        );
      },
    }),
    // A team that left has no placing; it sorts after every placed session.
    helper.accessor((row) => row.placing ?? Infinity, {
      id: 'placing',
      header: 'Placing',
      sortFn: sortFn_basic,
      cell: (context) => {
        const row = context.row.original;
        if (row.placing === null || row.placingTo === null) return 'left';
        const place = placingText(
          { rank: row.placing, rankTo: row.placingTo },
          (ordinalPlace) => ordinalPlace,
        );
        return `${place} of ${row.teamCount}`;
      },
    }),
    helper.accessor('totalPoints', {
      header: 'Points',
      sortFn: sortFn_basic,
    }),
    helper.accessor(sharePercent, {
      id: 'share',
      header: 'Share of max',
      sortFn: sortFn_basic,
      cell: (context) => `${context.getValue().toFixed(0)}%`,
    }),
    helper.accessor('correctCount', {
      header: 'Correct',
      sortFn: sortFn_basic,
    }),
    helper.accessor((row) => row.playerCount ?? -1, {
      id: 'playerCount',
      header: 'Players',
      sortFn: sortFn_basic,
      cell: (context) => context.row.original.playerCount ?? '—',
    }),
  ]);

interface TeamSessionsTableProps {
  sessions: TeamSessionRow[];
  /** Makes each session name a button instead of a link to the staff session stats page; the public team page uses it, as staff pages are closed to teams and its team code stays out of URLs. */
  onOpenSession?: (gameSessionId: number) => void;
}

/** A team's ended sessions, sortable and paginated in the browser (the server sends the whole history). */
export function TeamSessionsTable({
  sessions,
  onOpenSession,
}: TeamSessionsTableProps) {
  const columns = useMemo(() => buildColumns(onOpenSession), [onOpenSession]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'playedAt', desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const data = useMemo(() => sessions, [sessions]);

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => String(row.gameSessionId),
    enableSortingRemoval: false,
    state: { sorting, pagination },
    onSortingChange: (updater) => {
      setSorting(updater);
      setPagination((old) => ({ ...old, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
  });

  return (
    <div className="flex flex-col gap-3">
      <SortableTable table={table} emptyMessage="No sessions." />
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
    </div>
  );
}
