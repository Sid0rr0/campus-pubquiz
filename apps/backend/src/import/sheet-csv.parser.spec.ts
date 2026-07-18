import { parseSheetCsv, SheetFormatError } from '@/import/sheet-csv.parser';

const HEADER = 'round,type,question,options,answer,points,media_url,notes';

describe('parseSheetCsv', () => {
  it('parses one row per question with 1-based row numbers counting the header', () => {
    // Arrange
    const csv = [
      HEADER,
      'Round 1,free_text,Largest planet?,,Jupiter,2,,',
      'Round 1,multiple_choice,Capital of France?,Paris|London,Paris,2,,',
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
        notes: '',
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
        notes: '',
      },
    ]);
  });

  it('handles quoted fields with embedded commas and newlines', () => {
    const csv = [
      HEADER,
      'Round 1,free_text,"Which song contains ""Hello, world""\nand a second line?",,Hello,1,,',
    ].join('\n');

    const [row] = parseSheetCsv(csv);

    expect(row.question).toContain('Hello, world');
    expect(row.question).toContain('a second line');
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

  it('treats columns missing from the sheet as empty strings', () => {
    const csv = [
      'round,type,question,answer',
      'Round 1,free_text,Largest planet?,Jupiter',
    ].join('\n');

    const [row] = parseSheetCsv(csv);

    expect(row.options).toBe('');
    expect(row.points).toBe('');
    expect(row.mediaUrl).toBe('');
    expect(row.notes).toBe('');
  });

  it('skips fully empty rows but keeps sheet row numbering intact', () => {
    const csv = [
      HEADER,
      'Round 1,free_text,Largest planet?,,Jupiter,2,,',
      ',,,,,,,',
      'Round 1,free_text,Name this flag.,,Czechia,2,,',
    ].join('\n');

    const rows = parseSheetCsv(csv);

    expect(rows.map((row) => row.rowNumber)).toEqual([2, 4]);
  });

  it('throws SheetFormatError when a required column is missing', () => {
    const csv = ['round,question,answer', 'Round 1,Largest planet?,Jupiter'].join(
      '\n',
    );

    expect(() => parseSheetCsv(csv)).toThrow(SheetFormatError);
    expect(() => parseSheetCsv(csv)).toThrow(/type/);
  });

  it('throws SheetFormatError on malformed CSV instead of crashing', () => {
    const csv = [HEADER, '"unterminated quote,free_text,Q?,,A,1,,'].join('\n');

    expect(() => parseSheetCsv(csv)).toThrow(SheetFormatError);
  });
});
