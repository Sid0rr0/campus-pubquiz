import { describe, expect, it } from 'vitest';
import type { ImportRoundPreview } from '@campus-pubquiz/types';
import { csvFilename, quizToCsv } from '@/app/lib/quiz-csv-export';

const HEADER =
  'round,type,question,options,answer,points,media_url,answer_media_url,notes,break_after';
const BOM = '﻿';

function roundOf(
  overrides: Partial<ImportRoundPreview> = {},
): ImportRoundPreview {
  return { title: 'Round 1', breakAfter: false, questions: [], ...overrides };
}

function bodyLines(csv: string): string[] {
  return csv.replace(BOM, '').split('\r\n').slice(1);
}

describe('quizToCsv', () => {
  it('starts with a BOM and the importer header row', () => {
    const csv = quizToCsv([]);

    expect(csv).toBe(`${BOM}${HEADER}`);
  });

  it('writes a free_text question with blank optional cells', () => {
    const csv = quizToCsv([
      roundOf({
        title: 'General Knowledge',
        questions: [
          {
            type: 'free_text',
            prompt: 'What is the capital of France?',
            answer: 'Paris',
            points: 1,
          },
        ],
      }),
    ]);

    expect(bodyLines(csv)).toEqual([
      'General Knowledge,free_text,What is the capital of France?,,Paris,1,,,,',
    ]);
  });

  it('pipe-joins multiple choice options', () => {
    const csv = quizToCsv([
      roundOf({
        questions: [
          {
            type: 'multiple_choice',
            prompt: 'Red planet?',
            answer: 'Mars',
            points: 2,
            options: ['Mars', 'Venus', 'Jupiter'],
          },
        ],
      }),
    ]);

    expect(bodyLines(csv)).toEqual([
      'Round 1,multiple_choice,Red planet?,Mars|Venus|Jupiter,Mars,2,,,,',
    ]);
  });

  it('keeps the shuffled display options and canonical answer for sort', () => {
    const csv = quizToCsv([
      roundOf({
        questions: [
          {
            type: 'sort',
            prompt: 'Oldest first',
            answer: 'Jaws|Titanic|Inception',
            points: 3,
            options: ['Inception', 'Jaws', 'Titanic'],
          },
        ],
      }),
    ]);

    expect(bodyLines(csv)).toEqual([
      'Round 1,sort,Oldest first,Inception|Jaws|Titanic,Jaws|Titanic|Inception,3,,,,',
    ]);
  });

  it('packs match lists into options and rebuilds left+right pairs for the answer', () => {
    const csv = quizToCsv([
      roundOf({
        questions: [
          {
            type: 'match',
            prompt: 'Capitals',
            // Stored answer lists the right item for each left item, in left order.
            answer: 'France|Japan|Egypt',
            points: 3,
            options: ['Paris', 'Tokyo', 'Cairo'],
            matchTargets: ['Japan', 'Egypt', 'France'],
          },
        ],
      }),
    ]);

    expect(bodyLines(csv)).toEqual([
      'Round 1,match,Capitals,Paris|Tokyo|Cairo+Japan|Egypt|France,Paris+France|Tokyo+Japan|Cairo+Egypt,3,,,,',
    ]);
  });

  it('writes media urls and notes', () => {
    const csv = quizToCsv([
      roundOf({
        questions: [
          {
            type: 'youtube',
            prompt: 'Which movie?',
            answer: 'Sample',
            points: 2,
            mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
            answerMediaUrl: 'https://example.com/poster.jpg',
            notes: 'jot',
          },
        ],
      }),
    ]);

    expect(bodyLines(csv)).toEqual([
      'Round 1,youtube,Which movie?,,Sample,2,https://youtu.be/dQw4w9WgXcQ,https://example.com/poster.jpg,jot,',
    ]);
  });

  it('quotes cells containing commas, quotes, or line breaks', () => {
    const csv = quizToCsv([
      roundOf({
        title: 'Music, Movies',
        questions: [
          {
            type: 'free_text',
            prompt: 'Which band released "Abbey Road"?\nName them.',
            answer: 'The Beatles',
            points: 1,
            notes: '{start: "55", end: "88"}',
          },
        ],
      }),
    ]);

    expect(csv.replace(BOM, '')).toBe(
      `${HEADER}\r\n` +
        '"Music, Movies",free_text,"Which band released ""Abbey Road""?\nName them.",,The Beatles,1,,,"{start: ""55"", end: ""88""}",',
    );
  });

  it('marks break_after on the last question of each round that breaks', () => {
    const question = {
      type: 'free_text' as const,
      answer: 'a',
      points: 1,
    };
    const csv = quizToCsv([
      roundOf({
        title: 'A',
        breakAfter: true,
        questions: [
          { ...question, prompt: 'q1' },
          { ...question, prompt: 'q2' },
        ],
      }),
      roundOf({
        title: 'B',
        breakAfter: false,
        questions: [{ ...question, prompt: 'q3' }],
      }),
    ]);

    expect(bodyLines(csv)).toEqual([
      'A,free_text,q1,,a,1,,,,',
      'A,free_text,q2,,a,1,,,,1',
      'B,free_text,q3,,a,1,,,,',
    ]);
  });

  it('skips rounds that have no questions', () => {
    const csv = quizToCsv([roundOf({ title: 'Empty' })]);

    expect(bodyLines(csv)).toEqual([]);
  });
});

describe('csvFilename', () => {
  it('slugifies the quiz title', () => {
    expect(csvFilename('Campus Pub Quiz #3!')).toBe('campus-pub-quiz-3.csv');
  });

  it('falls back to "quiz" for a blank or symbol-only title', () => {
    expect(csvFilename('   ')).toBe('quiz.csv');
    expect(csvFilename('!!!')).toBe('quiz.csv');
  });
});
