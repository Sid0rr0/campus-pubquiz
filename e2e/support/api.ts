import fs from 'node:fs';
import {
  expect,
  type APIRequest,
  type APIRequestContext,
} from '@playwright/test';
import {
  ADMIN_PASSWORD,
  ADMIN_STORAGE_STATE,
  ADMIN_USERNAME,
  BACKEND_URL,
  PATHS,
} from './env';
import { takeLoginSlot } from './login-budget';

/** State-changing calls are refused without this header (`session.guard.ts`). */
const CSRF_HEADERS = { 'x-requested-with': 'XMLHttpRequest' } as const;

/** The settings a spec may choose when it creates a session; any other setting keeps the backend default. */
export interface SessionSettingsInput {
  lockGraceSeconds?: number;
}

export interface SeededSession {
  joinCode: string;
  quizId: number;
  quizTitle: string;
}

interface ImportPreviewResponse {
  isImportable: boolean;
  issues: unknown[];
  rounds: unknown[];
}

interface QuizSavedResponse {
  quizId: number;
}

interface SessionCreatedResponse {
  joinCode: string;
}

/** Logs the E2E admin in once and writes the cookie to `ADMIN_STORAGE_STATE`, for every context that acts as the quiz master. */
export async function saveAdminStorageState(
  playwrightRequest: APIRequest,
): Promise<void> {
  await takeLoginSlot();
  const api = await playwrightRequest.newContext({ baseURL: BACKEND_URL });
  try {
    const response = await api.post('/auth/login', {
      headers: CSRF_HEADERS,
      data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
    });
    expect(response.ok(), `admin login: ${response.status()}`).toBe(true);
    await api.storageState({ path: ADMIN_STORAGE_STATE });
  } finally {
    await api.dispose();
  }
}

/** A backend client that acts as the logged-in quiz master. */
export function newAdminApi(
  playwrightRequest: APIRequest,
): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL: BACKEND_URL,
    storageState: ADMIN_STORAGE_STATE,
    extraHTTPHeaders: CSRF_HEADERS,
  });
}

/** Imports the CSV fixture as a new quiz titled `quizTitle`: previews it (so a bad fixture fails here) and saves what the preview parsed. */
export async function importQuizNight(
  api: APIRequestContext,
  quizTitle: string,
): Promise<number> {
  const csvText = fs.readFileSync(PATHS.csvFixture, 'utf8');
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
  return ((await saveResponse.json()) as QuizSavedResponse).quizId;
}

/** Creates a session on the quiz and returns its join code. */
export async function createSession(
  api: APIRequestContext,
  quizId: number,
  name: string,
  settings: SessionSettingsInput,
): Promise<string> {
  const response = await api.post('/sessions', {
    data: { quizId, name, settings },
  });
  expect(response.ok(), `create session: ${await response.text()}`).toBe(true);
  return ((await response.json()) as SessionCreatedResponse).joinCode;
}
