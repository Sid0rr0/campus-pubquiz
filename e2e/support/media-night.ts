/**
 * What `fixtures/media.csv` holds, and how a session is made from it. One
 * round of six questions, each with a different kind of media.
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, type APIRequestContext } from '@playwright/test';
import { PATHS } from './env';

const MEDIA_CSV = path.join(PATHS.e2eRoot, 'fixtures', 'media.csv');
const HOST = 'https://example.invalid';
const YOUTUBE_ID = 'dQw4w9WgXcQ';

export const MEDIA_NIGHT = {
  roundTitle: 'Media',
  image: {
    prompt: 'Which landmark is pictured?',
    mediaUrl: `${HOST}/e2e-picture.png`,
  },
  audio: {
    prompt: 'Which band recorded the song you hear?',
    mediaUrl: `${HOST}/e2e-clip.mp3`,
  },
  /** A video file with a question clip (1 to 5 s) and a reveal clip (2 to 5 s). */
  video: {
    prompt: 'Which film is this scene from?',
    questionSrc: `${HOST}/e2e-scene.webm#t=1,5`,
    revealSrc: `${HOST}/e2e-scene.webm#t=2,5`,
    clipStartSeconds: 1,
  },
  /** A YouTube clip: question 10 to 20 s, reveal from 12 s to the end. */
  youtube: {
    prompt: 'Who sings this song?',
    questionSrc: `https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?autoplay=1&controls=0&modestbranding=1&enablejsapi=1&start=10&end=20`,
    revealSrc: `https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?autoplay=1&controls=0&modestbranding=1&enablejsapi=1&start=12`,
  },
  hiddenVideo: {
    prompt: 'Name the tune you hear',
    mediaUrl: `${HOST}/e2e-hidden.webm`,
  },
  /** No question media; the answer is a video (reveal clip 1 to 5 s). */
  answerVideo: {
    prompt: 'Which team won the final?',
    answerSrc: `${HOST}/e2e-answer.webm#t=1,5`,
  },
} as const;

interface ImportPreviewResponse {
  isImportable: boolean;
  issues: unknown[];
  rounds: unknown[];
}

/** Imports `fixtures/media.csv` as a new quiz titled `quizTitle` and returns its id. */
export async function importMediaNight(
  api: APIRequestContext,
  quizTitle: string,
): Promise<number> {
  const csvText = fs.readFileSync(MEDIA_CSV, 'utf8');
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
