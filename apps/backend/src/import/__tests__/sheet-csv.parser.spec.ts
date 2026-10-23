import { parseSheetCsv, SheetFormatError } from '@/import/sheet-csv.parser';

const HEADER =
  'round,type,question,options,answer,points,media_url,notes,break_after';

describe('parseSheetCsv', () => {
  it('parses one row per question with 1-based row numbers counting the header', () => {
    // Arrange
    const csv = [
      HEADER,
      'Round 1,free_text,Largest planet?,,Jupiter,2,,,1',
      'Round 1,multiple_choice,Capital of France?,Paris|London,Paris,2,,,',
    ].join('\n');

    // Act
    const rows = parseSheetCsv(csv);

    // Assert
    expect(rows).toEqual([
      {
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
        breakAfter: '1',
        category: '',
        author: '',
        roundNote: '',
        showRoundNote: '',
      },
      {
        rowNumber: 3,
        round: 'Round 1',
        type: 'multiple_choice',
        question: 'Capital of France?',
        options: 'Paris|London',
        answer: 'Paris',
        points: '2',
        mediaUrl: '',
        answerMediaUrl: '',
        notes: '',
        breakAfter: '',
        category: '',
        author: '',
        roundNote: '',
        showRoundNote: '',
      },
    ]);
  });

  it('reads the round_note and show_round_note columns, keeping line breaks in the note', () => {
    const csv = [
      `${HEADER},round_note,show_round_note`,
      'Round 1,free_text,Largest planet?,,Jupiter,2,,,1,"Say hi.\nThen go.",1',
    ].join('\n');

    const [row] = parseSheetCsv(csv);

    expect(row.roundNote).toBe('Say hi.\nThen go.');
    expect(row.showRoundNote).toBe('1');
  });

  it('handles quoted fields with embedded commas and newlines', () => {
    const csv = [
      HEADER,
      'Round 1,free_text,"Which song contains ""Hello, world""\nand a second line?",,Hello,1,,,',
    ].join('\n');

    const [row] = parseSheetCsv(csv);

    expect(row.question).toContain('Hello, world');
    expect(row.question).toContain('a second line');
  });

  it('handles a Google Sheets export with a quote inside the question text', () => {
    const csv = [
      HEADER,
      'Music,free_text,"Which band released the album ""Abbey Road""?",,The Beatles,1,,,',
    ].join('\n');

    const [row] = parseSheetCsv(csv);

    expect(row.question).toBe('Which band released the album "Abbey Road"?');
  });

  it('strips the BOM and tolerates header casing, spacing, and naming variants', () => {
    const csv = [
      '﻿Round, Type ,QUESTION,Options,Answer,Points,Media URL,Notes',
      'Round 1,free_text,Largest planet?,,Jupiter,2,https://example.com/pic.jpg,hi',
    ].join('\n');

    const [row] = parseSheetCsv(csv);

    expect(row.round).toBe('Round 1');
    expect(row.mediaUrl).toBe('https://example.com/pic.jpg');
    expect(row.notes).toBe('hi');
  });

  it('parses the answer_media_url column', () => {
    const csv = [
      'round,type,question,answer,answer_media_url',
      'Round 1,free_text,Largest planet?,Jupiter,https://example.com/answer.jpg',
    ].join('\n');

    const [row] = parseSheetCsv(csv);

    expect(row.answerMediaUrl).toBe('https://example.com/answer.jpg');
  });

  it('parses the break_after column as a raw cell, defaulting to empty when absent', () => {
    const withColumn = parseSheetCsv(
      [HEADER, 'Round 1,free_text,Largest planet?,,Jupiter,2,,,1'].join('\n'),
    );
    expect(withColumn[0].breakAfter).toBe('1');

    const withoutColumn = parseSheetCsv(
      [
        'round,type,question,answer',
        'Round 1,free_text,Largest planet?,Jupiter',
      ].join('\n'),
    );
    expect(withoutColumn[0].breakAfter).toBe('');
  });

  it('treats columns missing from the sheet as empty strings', () => {
    const csv = [
      'round,type,question,answer',
      'Round 1,free_text,Largest planet?,Jupiter',
    ].join('\n');

    const [row] = parseSheetCsv(csv);

    expect(row.options).toBe('');
    expect(row.points).toBe('');
    expect(row.mediaUrl).toBe('');
    expect(row.answerMediaUrl).toBe('');
    expect(row.notes).toBe('');
  });

  it('skips fully empty rows but keeps sheet row numbering intact', () => {
    const csv = [
      HEADER,
      'Round 1,free_text,Largest planet?,,Jupiter,2,,,',
      ',,,,,,,,',
      'Round 1,free_text,Name this flag.,,Czechia,2,,,',
      ' , ,  ,,,,,,',
    ].join('\n');

    const rows = parseSheetCsv(csv);

    expect(rows.map((row) => row.rowNumber)).toEqual([2, 4]);
  });

  it('reads a header written with spaces or a run of separators as its underscored name', () => {
    const csv = [
      'round,type,question,answer,break after,Answer  -  Media   URL',
      'Round 1,free_text,Largest planet?,Jupiter,1,https://example.com/a.jpg',
    ].join('\n');

    const [row] = parseSheetCsv(csv);

    expect(row.breakAfter).toBe('1');
    expect(row.answerMediaUrl).toBe('https://example.com/a.jpg');
  });

  it('accepts rows with fewer or more cells than the header', () => {
    const csv = [
      HEADER,
      'Round 1,free_text,Largest planet?',
      'Round 1,free_text,Name this flag.,,Czechia,2,,,1,extra,cells',
    ].join('\n');

    const rows = parseSheetCsv(csv);

    expect(rows[0]).toMatchObject({ question: 'Largest planet?', answer: '' });
    expect(rows[1]).toMatchObject({ answer: 'Czechia', breakAfter: '1' });
  });

  it('strips a BOM in front of a quoted first header cell', () => {
    const csv = [
      '﻿"round",type,question,answer',
      'Round 1,free_text,Largest planet?,Jupiter',
    ].join('\n');

    const [row] = parseSheetCsv(csv);

    expect(row.round).toBe('Round 1');
  });

  it('keeps sheet row numbering across a completely blank line', () => {
    const csv = [
      'round,type,question,answer',
      'Round 1,free_text,Largest planet?,Jupiter',
      '',
      'Round 1,free_text,Name this flag.,Czechia',
    ].join('\n');

    const rows = parseSheetCsv(csv);

    expect(rows.map((row) => row.rowNumber)).toEqual([2, 4]);
  });

  it('throws SheetFormatError on an empty CSV', () => {
    expect(() => parseSheetCsv('')).toThrow(SheetFormatError);
    expect(() => parseSheetCsv('')).toThrow('The CSV file is empty');
  });

  it('names its error SheetFormatError', () => {
    expect(() => parseSheetCsv('')).toThrow(
      expect.objectContaining({ name: 'SheetFormatError' }),
    );
  });

  it('throws SheetFormatError when a required column is missing', () => {
    const csv = [
      'round,question,answer',
      'Round 1,Largest planet?,Jupiter',
    ].join('\n');

    expect(() => parseSheetCsv(csv)).toThrow(SheetFormatError);
    expect(() => parseSheetCsv(csv)).toThrow(/type/);
  });

  it('names every missing required column and lists the expected headers', () => {
    const csv = ['round,notes', 'Round 1,hi'].join('\n');

    expect(() => parseSheetCsv(csv)).toThrow(
      'Missing required column(s): type, question, answer. ' +
        'Expected headers: round, type, question, options, answer, points, media_url, answer_media_url, notes, break_after, category, author, round_note, show_round_note.',
    );
  });

  it('throws SheetFormatError on malformed CSV instead of crashing, with a quoting hint', () => {
    const csv = [HEADER, '"unterminated quote,free_text,Q?,,A,1,,'].join('\n');

    expect(() => parseSheetCsv(csv)).toThrow(SheetFormatError);
    expect(() => parseSheetCsv(csv)).toThrow(
      /escape internal quotes by doubling/,
    );
    expect(() => parseSheetCsv(csv)).toThrow(
      /wrap the whole field in double quotes/,
    );
    expect(() => parseSheetCsv(csv)).toThrow(
      /^Could not parse the CSV file: .+\. If a field contains a comma, quote, or line break/,
    );
    expect(() => parseSheetCsv(csv)).toThrow(/""Abbey Road""\?"\)\.$/);
  });
});
