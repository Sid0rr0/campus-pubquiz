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

  it('takes the first non-blank category/author cell per round and omits them when every cell is blank', () => {
    const rows: SheetRow[] = [
      makeRow({ rowNumber: 2, round: 'History', category: '', author: '' }),
      makeRow({
        rowNumber: 3,
        round: 'History',
        question: 'Name this flag.',
        category: 'Geography',
        author: 'Alex',
      }),
      makeRow({
        rowNumber: 4,
        round: 'History',
        question: 'Name this king.',
        category: 'History',
        author: 'Sam',
      }),
      makeRow({
        rowNumber: 5,
        round: 'Music',
        question: 'Name this song.',
        category: '',
        author: '',
      }),
    ];

    const preview = assembleImportPreview('Trivia Night', rows);

    expect(preview.isImportable).toBe(true);
    expect(preview.rounds[0].category).toBe('Geography');
    expect(preview.rounds[0].author).toBe('Alex');
    expect(preview.rounds[1].category).toBeUndefined();
    expect(preview.rounds[1].author).toBeUndefined();
  });

  it('leaves category unset for a cell that is not one of the fixed list, rather than blocking the import', () => {
    const rows: SheetRow[] = [
      makeRow({ rowNumber: 2, round: 'History', category: 'Royalty' }),
    ];

    const preview = assembleImportPreview('Trivia Night', rows);

    expect(preview.isImportable).toBe(true);
    expect(preview.issues).toEqual([]);
    expect(preview.rounds[0].category).toBeUndefined();
  });

  it('accepts a category cell regardless of casing, normalizing it to the canonical spelling', () => {
    const rows: SheetRow[] = [
      makeRow({ rowNumber: 2, round: 'History', category: 'science & nature' }),
    ];

    const preview = assembleImportPreview('Trivia Night', rows);

    expect(preview.isImportable).toBe(true);
    expect(preview.rounds[0].category).toBe('Science & nature');
  });

  it('takes the first non-blank round_note and show_round_note per round, from any row', () => {
    const rows: SheetRow[] = [
      makeRow({ rowNumber: 2, round: 'History' }),
      makeRow({
        rowNumber: 3,
        round: 'History',
        roundNote: '  Say hi.\nThen the rules.  ',
        showRoundNote: '1',
      }),
      makeRow({
        rowNumber: 4,
        round: 'History',
        roundNote: 'Ignored later note',
        showRoundNote: '0',
      }),
      makeRow({ rowNumber: 5, round: 'Music', roundNote: 'Host only' }),
      makeRow({ rowNumber: 6, round: 'Film' }),
    ];

    const preview = assembleImportPreview('Trivia Night', rows);

    expect(preview.isImportable).toBe(true);
    expect(preview.rounds[0]).toMatchObject({
      note: 'Say hi.\nThen the rules.',
      showNoteOnScreen: true,
    });
    expect(preview.rounds[1].note).toBe('Host only');
    expect(preview.rounds[1].showNoteOnScreen).toBeUndefined();
    expect(preview.rounds[2].note).toBeUndefined();
    expect(preview.rounds[2].showNoteOnScreen).toBeUndefined();
  });

  it('lets an earlier show_round_note 0 win over a later 1, so the note stays off the big screen', () => {
    const rows: SheetRow[] = [
      makeRow({
        rowNumber: 2,
        round: 'History',
        roundNote: 'Say hi.',
        showRoundNote: '0',
      }),
      makeRow({ rowNumber: 3, round: 'History', showRoundNote: '1' }),
    ];

    const preview = assembleImportPreview('Trivia Night', rows);

    expect(preview.isImportable).toBe(true);
    expect(preview.rounds[0].note).toBe('Say hi.');
    expect(preview.rounds[0].showNoteOnScreen).toBeUndefined();
  });

  it('resolves show_round_note per round, not across rounds', () => {
    const rows: SheetRow[] = [
      makeRow({
        rowNumber: 2,
        round: 'History',
        roundNote: 'Say hi.',
        showRoundNote: '0',
      }),
      makeRow({
        rowNumber: 3,
        round: 'Music',
        roundNote: 'Host only',
        showRoundNote: '1',
      }),
    ];

    const preview = assembleImportPreview('Trivia Night', rows);

    expect(preview.rounds[0].showNoteOnScreen).toBeUndefined();
    expect(preview.rounds[1].showNoteOnScreen).toBe(true);
  });

  it('reports a round_note over the limit as an issue on that cell', () => {
    const rows: SheetRow[] = [
      makeRow({ rowNumber: 2, roundNote: 'x'.repeat(501) }),
      makeRow({ rowNumber: 3, roundNote: 'y'.repeat(500) }),
    ];

    const preview = assembleImportPreview('Trivia Night', rows);

    expect(preview.isImportable).toBe(false);
    expect(preview.issues).toEqual([
      expect.objectContaining({ rowNumber: 2, field: 'round_note' }),
    ]);
    expect(preview.issues[0].message).toMatch(/500/);
  });

  it('reports a show_round_note that is not blank, 0 or 1', () => {
    const preview = assembleImportPreview('Trivia Night', [
      makeRow({ rowNumber: 2, showRoundNote: 'yes' }),
    ]);

    expect(preview.issues).toEqual([
      expect.objectContaining({ rowNumber: 2, field: 'show_round_note' }),
    ]);
  });

  it('accepts show_round_note 1 with an empty note and stores no note', () => {
    const preview = assembleImportPreview('Trivia Night', [
      makeRow({ rowNumber: 2, showRoundNote: '1' }),
    ]);

    expect(preview.isImportable).toBe(true);
    expect(preview.rounds[0].note).toBeUndefined();
    expect(preview.rounds[0].showNoteOnScreen).toBeUndefined();
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
