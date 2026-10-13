import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import type { ReactTable, RowData, TableFeatures } from '@tanstack/react-table';

type SortableTableTone = 'muted' | 'dark-blue';

interface ToneClasses {
  wrapper: string;
  headerRow: string;
  headerCell: string;
  bodyRow: string;
  emptyCell: string;
}

const TONE_CLASSES: Record<SortableTableTone, ToneClasses> = {
  muted: {
    wrapper: 'border border-foreground/15',
    headerRow: 'border-b border-foreground/15 bg-foreground/5',
    headerCell: 'text-foreground/70',
    bodyRow: 'border-b border-foreground/10 last:border-b-0',
    emptyCell: 'text-foreground/50',
  },
  'dark-blue': {
    wrapper: 'border-2 border-dark-blue/15',
    headerRow: 'border-b-2 border-dark-blue/15 bg-dark-blue/5',
    headerCell: 'text-dark-blue/70',
    bodyRow: 'border-b border-dark-blue/10 last:border-b-0',
    emptyCell: 'text-dark-blue/50',
  },
};

interface SortingColumnApi {
  getCanSort: () => boolean;
  getIsSorted: () => false | 'asc' | 'desc';
  getToggleSortingHandler: () => ((event: unknown) => void) | undefined;
}

interface SortableTableProps<
  TFeatures extends TableFeatures,
  TData extends RowData,
> {
  table: ReactTable<TFeatures, TData>;
  /** Shown as one full-width row when the table has no rows. */
  emptyMessage?: string;
  tone?: SortableTableTone;
}

/** Renders a TanStack table; sorting, paging and data stay with the caller. */
export function SortableTable<
  TFeatures extends TableFeatures,
  TData extends RowData,
>({
  table,
  emptyMessage,
  tone = 'muted',
}: SortableTableProps<TFeatures, TData>) {
  const classes = TONE_CLASSES[tone];
  const rows = table.getRowModel().rows;

  return (
    <div className={`overflow-x-auto rounded-xl ${classes.wrapper}`}>
      <table className="w-full border-collapse text-left">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className={classes.headerRow}>
              {headerGroup.headers.map((header) => {
                // Tables built without the sorting feature have no sort API.
                const column = header.column as Partial<SortingColumnApi>;
                const isSortable = column.getCanSort?.() ?? false;
                const sorted = column.getIsSorted?.();
                return (
                  <th
                    key={header.id}
                    className={`px-4 py-2 font-display text-sm ${classes.headerCell}`}
                  >
                    {header.isPlaceholder ? null : isSortable ? (
                      <button
                        type="button"
                        onClick={column.getToggleSortingHandler?.()}
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
        <tbody>
          {rows.length === 0 && emptyMessage !== undefined ? (
            <tr>
              <td
                colSpan={table.getAllLeafColumns().length}
                className={`px-4 py-3 text-center ${classes.emptyCell}`}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className={classes.bodyRow}>
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
