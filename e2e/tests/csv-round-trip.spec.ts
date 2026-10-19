import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { ADMIN_STORAGE_STATE, PATHS } from '../support/env';
import { FULL_NIGHT } from '../support/full-night';

const ROUND_COUNT = 4;
const QUESTION_COUNT = 10;

/** Opens a blank editor, loads the CSV through the file picker and saves it as a quiz named after the file. */
async function importAndSave(
  page: Page,
  title: string,
  csv: Buffer,
): Promise<number> {
  await page.goto('/quizzes/new');
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: `${title}.csv`, mimeType: 'text/csv', buffer: csv });
  await expect(page.getByPlaceholder('Untitled quiz')).toHaveValue(title);
  await expect(
    page.getByText(`${ROUND_COUNT} rounds · ${QUESTION_COUNT} questions`),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save quiz' }).click();
  await expect(page).toHaveURL(/\/quizzes\/\d+$/);
  return Number(new URL(page.url()).pathname.split('/').pop());
}

/** The saved quiz as the server holds it, minus everything that differs by identity (ids, timestamps, title). */
async function savedQuizContent(
  api: APIRequestContext,
  quizId: number,
): Promise<unknown> {
  const response = await api.get(`/quizzes/${quizId}`);
  expect(response.ok(), `load quiz ${quizId}`).toBe(true);
  return stripIdentity(await response.json());
}

const IDENTITY_KEYS = new Set([
  'id',
  'quizId',
  'roundId',
  'title',
  'createdAt',
  'updatedAt',
  'liveEdit',
]);

function stripIdentity(value: unknown, isQuizRoot = true): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripIdentity(item, false));
  }
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => {
        // A round's own `title` is content; only the quiz's title is identity.
        if (key === 'title') return !isQuizRoot;
        return !IDENTITY_KEYS.has(key);
      })
      .map(([key, child]) => [key, stripIdentity(child, false)]),
  );
}

test('the full-night quiz exported as CSV re-imports as the same quiz', async ({
  newContext,
  adminApi,
}) => {
  const suffix = randomUUID().slice(0, 6);
  const originalTitle = `Round trip original ${suffix}`;
  const copyTitle = `Round trip copy ${suffix}`;
  const context = await newContext({
    storageState: ADMIN_STORAGE_STATE,
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // 1. Import the full-night CSV and save it.
  const originalId = await importAndSave(
    page,
    originalTitle,
    fs.readFileSync(PATHS.csvFixture),
  );
  await page.reload();
  await expect(page.getByPlaceholder('Untitled quiz')).toHaveValue(
    originalTitle,
  );

  // 2. Export it from the editor.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const exported = fs.readFileSync(await download.path());

  // The file carries the round titles, the media, the notes and the break placement.
  const exportedText = exported.toString('utf8');
  for (const needle of [
    FULL_NIGHT.warmUp.title,
    FULL_NIGHT.music.title,
    FULL_NIGHT.film.title,
    FULL_NIGHT.quickFire.title,
    FULL_NIGHT.warmUp.planet.imageUrl,
    FULL_NIGHT.music.band.audioUrl,
    FULL_NIGHT.warmUp.note,
    FULL_NIGHT.music.note,
    FULL_NIGHT.warmUp.category,
    FULL_NIGHT.film.author,
  ]) {
    expect(exportedText, `export holds "${needle}"`).toContain(needle);
  }

  // 3. Re-import the exported file as a new quiz.
  const copyId = await importAndSave(page, copyTitle, exported);
  expect(copyId).not.toBe(originalId);

  // 4. The copy matches the original question by question.
  expect(await savedQuizContent(adminApi, copyId)).toEqual(
    await savedQuizContent(adminApi, originalId),
  );
});
