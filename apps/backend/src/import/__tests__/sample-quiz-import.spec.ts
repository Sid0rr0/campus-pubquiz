import { readFileSync } from 'fs';
import { join } from 'path';
import { parseSheetCsv } from '@/import/sheet-csv.parser';
import { assembleImportPreview } from '@/import/question-row.schema';

const SAMPLE_CSV_PATH = join(
  __dirname,
  '../../../../frontend/public/sample-quiz-import.csv',
);

describe('sample-quiz-import.csv', () => {
  const preview = assembleImportPreview(
    'Sample',
    parseSheetCsv(readFileSync(SAMPLE_CSV_PATH, 'utf8')),
  );

  it('imports without issues', () => {
    expect(preview.issues).toEqual([]);
    expect(preview.isImportable).toBe(true);
  });

  it('covers every question type once or more, including number', () => {
    const types = preview.rounds.flatMap((round) =>
      round.questions.map((question) => question.type),
    );

    expect(new Set(types)).toEqual(
      new Set([
        'free_text',
        'multiple_choice',
        'closest_guess',
        'number',
        'sort',
        'match',
      ]),
    );
  });

  it('carries an audio file on an ordinary question', () => {
    const audioQuestions = preview.rounds
      .flatMap((round) => round.questions)
      .filter((question) => question.mediaUrl?.endsWith('.mp3'));

    expect(audioQuestions).toEqual([
      expect.objectContaining({ type: 'free_text' }),
    ]);
  });

  it('carries a clip, a reveal clip and a hidden video from the notes group', () => {
    const youtubeQuestions = preview.rounds
      .flatMap((round) => round.questions)
      .filter((question) => question.mediaUrl?.includes('youtube.com'));

    expect(youtubeQuestions).toEqual([
      expect.objectContaining({
        mediaStartSeconds: 55,
        mediaEndSeconds: 88,
      }),
      expect.objectContaining({
        mediaStartSeconds: 10,
        mediaEndSeconds: 25,
        revealStartSeconds: 43,
        revealEndSeconds: 58,
        isVideoHidden: true,
      }),
    ]);
  });

  it('gives one round a host-only note and another a note shown on screen', () => {
    expect(
      preview.rounds.map(({ title, note, showNoteOnScreen }) => ({
        title,
        hasNote: Boolean(note),
        showNoteOnScreen: showNoteOnScreen ?? false,
      })),
    ).toEqual([
      { title: 'General Knowledge', hasNote: true, showNoteOnScreen: false },
      { title: 'Music & Movies', hasNote: true, showNoteOnScreen: true },
    ]);
  });

  it('gives each round a category and an author', () => {
    expect(
      preview.rounds.map(({ title, category, author }) => ({
        title,
        category,
        author,
      })),
    ).toEqual([
      {
        title: 'General Knowledge',
        category: 'General knowledge',
        author: 'Sample Author',
      },
      {
        title: 'Music & Movies',
        category: 'Film & TV',
        author: 'Sample Author',
      },
    ]);
  });
});
