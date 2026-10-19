import fs from 'node:fs';
import path from 'node:path';
import { expect, type APIRequestContext } from '@playwright/test';
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

interface ImportPreviewResponse {
  isImportable: boolean;
  issues: unknown[];
  rounds: unknown[];
}

/** Imports `fixtures/remote.csv` as a new quiz titled `quizTitle` and returns its id. */
export async function importRemoteQuiz(
  api: APIRequestContext,
  quizTitle: string,
): Promise<number> {
  const csvText = fs.readFileSync(REMOTE_CSV, 'utf8');
  const previewResponse = await api.post('/import/preview', {
    data: { csvText, quizTitle },
  });
  expect(previewResponse.ok(), 'import preview').toBe(true);
  const preview = (await previewResponse.json()) as ImportPreviewResponse;
  expect(preview.issues, 'import issues').toEqual([]);
  expect(preview.isImportable).toBe(true);

  const saveResponse = await api.post('/quizzes', {
    data: { title: quizTitle, rounds: preview.rounds },
  });
  expect(saveResponse.ok(), `save quiz: ${await saveResponse.text()}`).toBe(
    true,
  );
  return ((await saveResponse.json()) as { quizId: number }).quizId;
}
