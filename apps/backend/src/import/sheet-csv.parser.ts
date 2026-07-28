import { parse } from 'csv-parse/sync';
import type { SheetRow } from '@campus-pubquiz/types';

export class SheetFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SheetFormatError';
  }
}

type SheetColumn = Exclude<keyof SheetRow, 'rowNumber'>;

/** Normalized header cell → SheetRow field. Unknown headers are ignored. */
const HEADER_ALIASES: Record<string, SheetColumn> = {
  round: 'round',
  type: 'type',
  question: 'question',
  options: 'options',
  answer: 'answer',
  points: 'points',
  media_url: 'mediaUrl',
  mediaurl: 'mediaUrl',
  notes: 'notes',
  break_after: 'breakAfter',
};

const REQUIRED_COLUMNS: SheetColumn[] = ['round', 'type', 'question', 'answer'];

function normalizeHeaderCell(cell: string): string {
  return cell
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function parseRecords(csvText: string): string[][] {
  try {
    return parse(csvText, {
      bom: true,
      relax_column_count: true,
      skip_empty_lines: false,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new SheetFormatError(`Could not parse the CSV file: ${detail}`);
  }
}

/**
 * Parses a sheet CSV export into raw rows. Row numbers are 1-based CSV
 * records counting the header, matching the row numbers authors see in
 * Google Sheets. Fully empty rows are skipped but keep numbering intact.
 * `break_after` is an optional column; missing or blank cells default to
 * "no break" and are resolved downstream in question-row.schema.ts.
 */
export function parseSheetCsv(csvText: string): SheetRow[] {
  const records = parseRecords(csvText);
  if (records.length === 0) {
    throw new SheetFormatError('The CSV file is empty');
  }

  const [headerCells, ...dataRecords] = records;
  const columns = headerCells.map(
    (cell) => HEADER_ALIASES[normalizeHeaderCell(cell)] ?? null,
  );
  const presentColumns = new Set(columns.filter(Boolean));
  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) => !presentColumns.has(column),
  );
  if (missingColumns.length > 0) {
    throw new SheetFormatError(
      `Missing required column(s): ${missingColumns.join(', ')}. ` +
        'Expected headers: round, type, question, options, answer, points, media_url, notes, break_after.',
    );
  }

  return dataRecords.flatMap((record, index) => {
    if (record.every((cell) => cell.trim() === '')) {
      return [];
    }
    const cellFor = (column: SheetColumn): string => {
      const columnIndex = columns.indexOf(column);
      return columnIndex === -1 ? '' : (record[columnIndex] ?? '');
    };
    return [
      {
        rowNumber: index + 2,
        round: cellFor('round'),
        type: cellFor('type'),
        question: cellFor('question'),
        options: cellFor('options'),
        answer: cellFor('answer'),
        points: cellFor('points'),
        mediaUrl: cellFor('mediaUrl'),
        notes: cellFor('notes'),
        breakAfter: cellFor('breakAfter'),
      },
    ];
  });
}
