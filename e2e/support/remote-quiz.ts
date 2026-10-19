import path from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import { importCsvQuiz } from './csv-session';
import { PATHS } from './env';

/**
 * What `fixtures/remote.csv` holds: one round of three `free_text` questions
 * (plain, mp3, YouTube) with a round note, then a break.
 */
export const REMOTE_QUIZ = {
  roundTitle: 'Remote round',
  roundNote: 'Thank the sponsor.',
  plain: {
    prompt: 'What is 2 + 2?',
    key: '4',
    notes: 'Read it slowly.',
  },
  audio: {
    prompt: 'Which band recorded the song you hear?',
    mediaUrl: 'https://example.invalid/e2e-clip.mp3',
  },
  youtube: {
    prompt: 'Which singer is in this video?',
    videoId: 'dQw4w9WgXcQ',
  },
} as const;

const REMOTE_CSV = path.join(PATHS.e2eRoot, 'fixtures', 'remote.csv');

/** Imports `fixtures/remote.csv` as a new quiz titled `quizTitle` and returns its id. */
export function importRemoteQuiz(
  api: APIRequestContext,
  quizTitle: string,
): Promise<number> {
  return importCsvQuiz(api, REMOTE_CSV, quizTitle);
}
