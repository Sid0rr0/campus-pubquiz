'use client';

import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import type { SessionDetailStats } from '@campus-pubquiz/types';
import { formatResponseMs } from '@/app/stats/[id]/format-response-ms';

interface QuestionsTableProps {
  questions: SessionDetailStats['questions'];
  allCorrectQuestionIds: number[];
  noneCorrectQuestionIds: number[];
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
const helper = createColumnHelper<
  typeof features,
  SessionDetailStats['questions'][number]
>();

export function QuestionsTable({
  questions,
  allCorrectQuestionIds,
  noneCorrectQuestionIds,
}: QuestionsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const allCorrectSet = useMemo(
    () => new Set(allCorrectQuestionIds),
    [allCorrectQuestionIds],
  );
  const noneCorrectSet = useMemo(
    () => new Set(noneCorrectQuestionIds),
    [noneCorrectQuestionIds],
  );

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('roundTitle', {
          header: 'Round',
          sortFn: sortFn_alphanumeric,
        }),
        helper.accessor('prompt', {
          header: 'Question',
          sortFn: sortFn_alphanumeric,
          cell: (context) => {
            const question = context.row.original;
            return (
              <span>
                {context.getValue()}
                {allCorrectSet.has(question.questionId) && (
                  <span className="ml-2 rounded-full bg-cyan px-2 py-0.5 text-xs font-extrabold text-white">
                    All correct
                  </span>
                )}
                {noneCorrectSet.has(question.questionId) && (
                  <span className="ml-2 rounded-full bg-magenta px-2 py-0.5 text-xs font-extrabold text-white">
                    Nobody correct
                  </span>
                )}
              </span>
            );
          },
        }),
        helper.accessor('points', { header: 'Points', sortFn: sortFn_basic }),
        helper.accessor('answeredCount', {
          header: 'Answered',
          sortFn: sortFn_basic,
        }),
        helper.accessor((q) => q.correctRate, {
          id: 'correctRate',
          header: 'Correct rate',
          sortFn: sortFn_basic,
          cell: (context) => `${(context.getValue() * 100).toFixed(0)}%`,
        }),
        helper.accessor((q) => q.fastestResponseMs ?? Infinity, {
          id: 'fastestResponseMs',
          header: 'Fastest response',
          sortFn: sortFn_basic,
          cell: (context) =>
            formatResponseMs(context.row.original.fastestResponseMs),
        }),
      ]),
    [allCorrectSet, noneCorrectSet],
  );

  const table = useTable({
    features,
    columns,
    data: questions,
    getRowId: (question) => String(question.questionId),
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
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
                colSpan={6}
                className="px-4 py-3 text-center text-foreground/50"
              >
                No questions in this quiz.
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
  );
}
