import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  tableFeatures,
  useTable,
  type SortingState,
} from '@tanstack/react-table';
import { SortableTable } from '../sortable-table';

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
const helper = createColumnHelper<
  typeof features,
  { name: string; n: number }
>();
const columns = helper.columns([
  helper.accessor('name', { header: 'Name', enableSorting: false }),
  helper.accessor('n', { header: 'Count', sortFn: sortFn_basic }),
]);

function Harness() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useTable({
    features,
    columns,
    data: [
      { name: 'a', n: 2 },
      { name: 'b', n: 1 },
    ],
    state: { sorting },
    onSortingChange: setSorting,
  });
  return <SortableTable table={table} />;
}

describe('SortableTable aria-sort', () => {
  it('marks sortable headers none, then descending, then ascending; leaves others unmarked', async () => {
    render(<Harness />);
    const count = screen.getByRole('columnheader', { name: 'Count' });
    const name = screen.getByRole('columnheader', { name: 'Name' });

    expect(count).toHaveAttribute('aria-sort', 'none');
    expect(name).not.toHaveAttribute('aria-sort');

    await userEvent.click(screen.getByRole('button', { name: 'Count' }));
    expect(count).toHaveAttribute('aria-sort', 'descending');

    await userEvent.click(screen.getByRole('button', { name: 'Count' }));
    expect(count).toHaveAttribute('aria-sort', 'ascending');
    expect(name).not.toHaveAttribute('aria-sort');
  });
});
