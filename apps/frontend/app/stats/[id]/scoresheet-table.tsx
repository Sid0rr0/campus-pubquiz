'use client';

import { useMemo } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import type {
  SessionDetailScoresheetCell,
  SessionDetailStats,
  Verdict,
} from '@campus-pubquiz/types';
import { JokerMark } from '@/app/components/joker-mark';
import { formatRankLabel } from '@/app/lib/rank-label';

interface ScoresheetTableProps {
  standings: SessionDetailStats['standings'];
  rounds: SessionDetailStats['rounds'];
  /** In display order: round order, then question order within the round. */
  questions: SessionDetailStats['questions'];
  scoresheet: SessionDetailScoresheetCell[];
}

type StandingRow = SessionDetailStats['standings'][number];

// Rows keep the server's ranking until a sortable header is clicked.
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
const helper = createColumnHelper<typeof features, StandingRow>();

const VERDICT_CELL_CLASS: Record<Verdict, string> = {
  correct: 'bg-green/25',
  partial: 'bg-yellow/35',
  incorrect: '',
};

// Rank and Team (and the blank header above them) stay put while the
// question columns scroll under them; Rank's fixed width is Team's offset.
const STICKY_CLASS: Record<string, string> = {
  team: 'sticky left-0 z-10 border-r border-foreground/15',
  rank: 'sticky left-0 z-10 w-24 min-w-24 max-w-24',
  teamName: 'sticky left-24 z-10 border-r border-foreground/15',
};

// Opaque, so the cells scrolling under a sticky header don't show through.
const HEADER_BG =
  'bg-[color-mix(in_oklab,var(--color-foreground)_5%,var(--color-background))]';

const QUESTION_COLUMN_PREFIX = 'question-';

const ROUND_BORDER_CLASS = 'border-l border-foreground/15';

function cellKey(teamId: number, questionId: number): string {
  return `${teamId}:${questionId}`;
}

/** A cell's look: points coloured by verdict, "—" for no answer, a muted "?" while ungraded. */
function ScoresheetCellContent({
  cell,
}: {
  cell: SessionDetailScoresheetCell | undefined;
}) {
  if (!cell) return <span className="text-foreground/40">—</span>;
  if (cell.verdict === null) {
    return (
      <span title={cell.answer} className="text-foreground/40">
        ?
      </span>
    );
  }
  return (
    <span title={cell.answer}>
      {cell.pointsAwarded}
      {cell.isJoker && (
        <>
          {' '}
          <JokerMark />
        </>
      )}
    </span>
  );
}

/** The Scoresheet: one row per team that took part, one column per question, grouped by round. */
export function ScoresheetTable({
  standings,
  rounds,
  questions,
  scoresheet,
}: ScoresheetTableProps) {
  const cellsByKey = useMemo(
    () =>
      new Map(
        scoresheet.map((cell) => [cellKey(cell.teamId, cell.questionId), cell]),
      ),
    [scoresheet],
  );

  // The columns a border separates from the round before them: each later
  // round (its header and first question) and the totals. The first round
  // already sits against Team's border.
  const roundBorderColumnIds = useMemo(() => {
    const roundsWithQuestions = rounds.flatMap((round) => {
      const first = questions.find(
        (question) => question.roundId === round.roundId,
      );
      return first ? [{ roundId: round.roundId, first }] : [];
    });
    return new Set([
      ...roundsWithQuestions
        .slice(1)
        .flatMap(({ roundId, first }) => [
          `round-${roundId}`,
          `${QUESTION_COLUMN_PREFIX}${first.questionId}`,
        ]),
      'totals',
      'bonusPoints',
    ]);
  }, [rounds, questions]);

  const columns = useMemo(() => {
    const roundGroups = rounds.flatMap((round, roundIndex) => {
      const roundQuestions = questions.filter(
        (question) => question.roundId === round.roundId,
      );
      if (roundQuestions.length === 0) return [];
      return [
        helper.group({
          id: `round-${round.roundId}`,
          header: () => <span title={round.title}>Round {roundIndex + 1}</span>,
          columns: helper.columns(
            roundQuestions.map((question, questionIndex) =>
              // A missing answer sorts below every scored one.
              helper.accessor(
                (entry) =>
                  cellsByKey.get(cellKey(entry.teamId, question.questionId))
                    ?.pointsAwarded ?? -1,
                {
                  id: `${QUESTION_COLUMN_PREFIX}${question.questionId}`,
                  header: () => (
                    <span
                      title={`${question.prompt}\nAnswer: ${question.answer}`}
                    >
                      Q{questionIndex + 1}
                    </span>
                  ),
                  sortFn: sortFn_basic,
                  cell: (context) => (
                    <ScoresheetCellContent
                      cell={cellsByKey.get(
                        cellKey(
                          context.row.original.teamId,
                          question.questionId,
                        ),
                      )}
                    />
                  ),
                },
              ),
            ),
          ),
        }),
      ];
    });
    return helper.columns([
      helper.group({
        id: 'team',
        header: '',
        columns: helper.columns([
          helper.display({
            id: 'rank',
            header: 'Rank',
            cell: (context) => {
              const { rank, rankTo } = context.row.original;
              return rank === null || rankTo === null
                ? 'left'
                : formatRankLabel({ rank, rankTo });
            },
          }),
          helper.accessor('teamName', {
            header: 'Team',
            enableSorting: false,
          }),
        ]),
      }),
      ...roundGroups,
      helper.group({
        id: 'totals',
        header: '',
        columns: helper.columns([
          helper.accessor('bonusPoints', {
            header: 'Bonus',
            enableSorting: false,
          }),
          helper.accessor('total', { header: 'Total', sortFn: sortFn_basic }),
        ]),
      }),
    ]);
  }, [rounds, questions, cellsByKey]);

  const table = useTable({
    features,
    columns,
    data: standings,
    getRowId: (entry) => String(entry.teamId),
  });

  const verdictClass = (columnId: string, teamId: number): string => {
    if (!columnId.startsWith(QUESTION_COLUMN_PREFIX)) return '';
    const questionId = Number(columnId.slice(QUESTION_COLUMN_PREFIX.length));
    const verdict = cellsByKey.get(cellKey(teamId, questionId))?.verdict;
    return verdict ? VERDICT_CELL_CLASS[verdict] : '';
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-foreground/15">
      {/* border-separate: collapsed borders stay behind when sticky cells move. */}
      <table className="w-full border-separate border-spacing-0 text-left">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const column = header.column;
                const isSortable = column.getCanSort();
                const sorted = column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    aria-sort={
                      sorted === 'asc'
                        ? 'ascending'
                        : sorted === 'desc'
                          ? 'descending'
                          : isSortable
                            ? 'none'
                            : undefined
                    }
                    className={`whitespace-nowrap border-b border-foreground/15 px-3 py-2 font-display text-sm text-foreground/70 ${HEADER_BG} ${STICKY_CLASS[column.id] ?? ''} ${roundBorderColumnIds.has(column.id) ? ROUND_BORDER_CLASS : ''}`}
                  >
                    {header.isPlaceholder ? null : isSortable ? (
                      <button
                        type="button"
                        onClick={column.getToggleSortingHandler()}
                        className="flex items-center gap-1"
                      >
                        <table.FlexRender header={header} />
                        {sorted === 'asc' && (
                          <ChevronUpIcon aria-hidden="true" />
                        )}
                        {sorted === 'desc' && (
                          <ChevronDownIcon aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="[&>tr:last-child>td]:border-b-0">
          {standings.length === 0 ? (
            <tr>
              <td
                colSpan={table.getAllLeafColumns().length}
                className="px-4 py-3 text-center text-foreground/50"
              >
                No teams joined this session.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={row.original.hasLeft ? 'text-foreground/50' : ''}
              >
                {row.getAllCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`whitespace-nowrap border-b border-foreground/10 px-3 py-2 ${cell.column.id in STICKY_CLASS ? `bg-background ${STICKY_CLASS[cell.column.id]}` : verdictClass(cell.column.id, row.original.teamId)} ${roundBorderColumnIds.has(cell.column.id) ? ROUND_BORDER_CLASS : ''}`}
                  >
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
