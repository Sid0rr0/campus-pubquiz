import type { SheetRow } from '@campus-pubquiz/types';

export function makeRow(overrides: Partial<SheetRow> = {}): SheetRow {
  return {
    rowNumber: 2,
    round: 'Round 1',
    type: 'free_text',
    question: 'Largest planet?',
    options: '',
    answer: 'Jupiter',
    points: '2',
    mediaUrl: '',
    answerMediaUrl: '',
    notes: '',
    breakAfter: '',
    ...overrides,
  };
}
