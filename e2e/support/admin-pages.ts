import { expect, type Locator, type Page } from '@playwright/test';
import { recordMove } from './coverage';
import type { ControlScreen } from './screens/control-screen';

/**
 * The quiz master ends the quiz from the sidebar and confirms the dialog.
 * The session then counts as played (it shows on /stats and /teams).
 */
export async function endQuiz(control: ControlScreen): Promise<void> {
  await control.page
    .locator('aside')
    .getByRole('button', { name: 'End Quiz' })
    .click();
  await control.page
    .getByRole('alertdialog', { name: 'End this quiz?' })
    .getByRole('button', { name: 'End Quiz', exact: true })
    .click();
  await control.expectStatus('ended');
  recordMove('end_quiz');
}

/**
 * The table row containing `text`, paging forward through a paginated admin
 * table (`Next`) until it shows up. Other tests run at the same time, so the
 * row this test made is not always on the first page.
 */
export async function findRowAcrossPages(
  page: Page,
  text: string,
): Promise<Locator> {
  const row = page.getByRole('row').filter({ hasText: text });
  const next = page.getByRole('button', { name: 'Next', exact: true });
  const previous = page.getByRole('button', { name: 'Prev', exact: true });
  await expect(next).toBeVisible();
  // Start from the first page, whichever page an earlier search stopped on.
  while (await previous.isEnabled()) {
    await previous.click();
    await page.waitForLoadState('networkidle');
  }
  for (;;) {
    if ((await row.count()) > 0) return row;
    if (await next.isDisabled()) break;
    await next.click();
    // The table keeps showing the previous page until the next one arrives.
    await page.waitForLoadState('networkidle');
  }
  // Last page reached without a hit: fail with a readable assertion.
  await expect(row).toHaveCount(1);
  return row;
}
