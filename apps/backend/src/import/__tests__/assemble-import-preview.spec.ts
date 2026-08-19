import type { SheetRow } from '@campus-pubquiz/types';
import { assembleImportPreview } from '@/import/question-row.schema';
import { makeRow } from '@/import/__tests__/question-row-test-utils';

describe('assembleImportPreview', () => {
  it('groups questions into rounds by first appearance and resolves break_after per round', () => {
    // Arrange
    const rows: SheetRow[] = [
      makeRow({ rowNumber: 2, round: 'History', breakAfter: '0' }),
      makeRow({
        rowNumber: 3,
        round: 'Music',
        question: 'Name this song.',
        breakAfter: '0',
      }),
      makeRow({
        rowNumber: 4,
        round: 'History',
        question: 'Name this flag.',
        breakAfter: '0',
      }),
    ];

    // Act
    const preview = assembleImportPreview('Trivia Night', rows);

    // Assert
    expect(preview.isImportable).toBe(true);
    expect(preview.quizTitle).toBe('Trivia Night');
    expect(preview.rounds.map((round) => round.title)).toEqual([
      'History',
      'Music',
    ]);
    expect(preview.rounds[0].questions).toHaveLength(2);
    expect(preview.rounds[0].breakAfter).toBe(false);
    expect(preview.rounds[1].breakAfter).toBe(true);
  });

  it('marks a non-final round as breaking if any of its rows has break_after "1"', () => {
    const rows: SheetRow[] = [
      makeRow({ rowNumber: 2, round: 'History', breakAfter: '' }),
      makeRow({
        rowNumber: 3,
        round: 'History',
        question: 'Name this flag.',
        breakAfter: '1',
      }),
      makeRow({
        rowNumber: 4,
        round: 'Music',
        question: 'Name this song.',
        breakAfter: '',
      }),
    ];

    const preview = assembleImportPreview('Trivia Night', rows);

    expect(preview.rounds[0].breakAfter).toBe(true);
  });

  it('always forces the last round to break, even when every one of its rows is blank/0', () => {
    const rows: SheetRow[] = [
      makeRow({ rowNumber: 2, round: 'History', breakAfter: '1' }),
      makeRow({
        rowNumber: 3,
        round: 'Music',
        question: 'Name this song.',
        breakAfter: '0',
      }),
    ];

    const preview = assembleImportPreview('Trivia Night', rows);

    expect(preview.isImportable).toBe(true);
    expect(preview.rounds[1].title).toBe('Music');
    expect(preview.rounds[1].breakAfter).toBe(true);
  });

  it('reports issues from every broken row and blocks the import', () => {
    const rows: SheetRow[] = [
      makeRow({ rowNumber: 2, breakAfter: '1' }),
      makeRow({ rowNumber: 3, answer: '' }),
      makeRow({ rowNumber: 4, type: 'karaoke' }),
    ];

    const preview = assembleImportPreview('Trivia Night', rows);

    expect(preview.isImportable).toBe(false);
    expect(preview.issues.map((issue) => issue.rowNumber)).toEqual([3, 4]);
    expect(preview.rounds[0].questions).toHaveLength(1);
  });
});
