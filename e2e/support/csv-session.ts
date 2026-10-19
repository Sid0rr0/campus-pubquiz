import fs from 'node:fs';
import { expect, type APIRequestContext } from '@playwright/test';
import {
  createSession,
  type SeededSession,
  type SessionSettingsInput,
} from './api';

type QuizRound = Record<string, unknown>;

interface ImportPreviewResponse {
  isImportable: boolean;
  issues: unknown[];
  rounds: QuizRound[];
}

interface QuizSavedResponse {
  quizId: number;
}

/**
 * Imports the CSV at `csvPath` as a new quiz titled `quizTitle`: previews it (so a bad fixture fails here) and saves what the preview parsed.
 * `mapRounds` changes a round before it is saved, for what no CSV column sets (e.g. `kahootMode`).
 */
export async function importCsvQuiz(
  api: APIRequestContext,
  csvPath: string,
  quizTitle: string,
  mapRounds: (round: QuizRound, index: number) => QuizRound = (round) => round,
): Promise<number> {
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const previewResponse = await api.post('/import/preview', {
    data: { csvText, quizTitle },
  });
  expect(previewResponse.ok(), 'import preview').toBe(true);
  const preview = (await previewResponse.json()) as ImportPreviewResponse;
  expect(preview.issues, 'import issues').toEqual([]);
  expect(preview.isImportable).toBe(true);

  const saveResponse = await api.post('/quizzes', {
    data: { title: quizTitle, rounds: preview.rounds.map(mapRounds) },
  });
  expect(saveResponse.ok(), `save quiz: ${await saveResponse.text()}`).toBe(
    true,
  );
  return ((await saveResponse.json()) as QuizSavedResponse).quizId;
}

/** A session on its own copy of the quiz in the CSV at `csvPath`. */
export async function seedCsvSession(
  api: APIRequestContext,
  csvPath: string,
  quizTitle: string,
  settings: SessionSettingsInput,
  mapRounds?: (round: QuizRound, index: number) => QuizRound,
): Promise<SeededSession> {
  const quizId = await importCsvQuiz(api, csvPath, quizTitle, mapRounds);
  const joinCode = await createSession(api, quizId, quizTitle, settings);
  return { joinCode, quizId, quizTitle };
}
