import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { expect, test } from '../fixtures';
import { ADMIN_PASSWORD, ADMIN_USERNAME, PATHS } from '../support/env';
import { takeLoginSlot } from '../support/login-budget';
import { QUIZ_NIGHT } from '../support/quiz-night';

test('the quiz master logs in on the login page and imports the quiz CSV', async ({
  newContext,
}) => {
  // The login is limited to 5 per minute; this waits for a free slot when
  // several runs of this test (--repeat-each) log in close together.
  await takeLoginSlot();
  const page = await (await newContext()).newPage();

  await page.goto('/login');
  await page.getByLabel('Username').fill(ADMIN_USERNAME);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/sessions$/);

  // The quiz is named after the file, so each run saves a quiz of its own.
  const quizTitle = `UI import ${randomUUID().slice(0, 6)}`;
  await page.goto('/quizzes/new');
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: `${quizTitle}.csv`,
      mimeType: 'text/csv',
      buffer: fs.readFileSync(PATHS.csvFixture),
    });

  await expect(page.getByPlaceholder('Untitled quiz')).toHaveValue(quizTitle);
  await expect(
    page.getByText(
      `${QUIZ_NIGHT.roundCount} rounds · ${QUIZ_NIGHT.questionCount} questions`,
    ),
  ).toBeVisible();
  await expect(page.getByPlaceholder('Question prompt').first()).toHaveValue(
    QUIZ_NIGHT.freeText.prompt,
  );

  await page.getByRole('button', { name: 'Save quiz' }).click();
  await expect(page).toHaveURL(/\/quizzes\/\d+$/);

  // The saved quiz comes back from the server on a fresh load.
  await page.reload();
  await expect(page.getByPlaceholder('Untitled quiz')).toHaveValue(quizTitle);
  await expect(page.getByPlaceholder('Question prompt').first()).toHaveValue(
    QUIZ_NIGHT.freeText.prompt,
  );
});
