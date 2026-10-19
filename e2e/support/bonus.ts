/**
 * Bonus awards as the people in the room see them: the quiz master gives one
 * from the Teams table on /control, the awarded team's phone shows a toast.
 */
import { expect } from '@playwright/test';
import type { DisplayScreen } from './screens/display-screen';
import type { ControlScreen } from './screens/control-screen';
import type { PhoneScreen } from './screens/phone-screen';

/** The predefined categories of the award form, by their button label. */
const CATEGORY_LABELS = { shot: 'Shot', selfie: 'Selfie' } as const;
type PredefinedCategory = keyof typeof CATEGORY_LABELS;

/** Gives `teamName` an award in a predefined `category` through the Teams table (Actions > Award bonus) and waits for the quiz master's confirmation toast. */
export async function awardBonus(
  control: ControlScreen,
  teamName: string,
  category: PredefinedCategory,
  points: number,
): Promise<void> {
  const { page } = control;
  await page.getByRole('button', { name: `Actions for ${teamName}` }).click();
  await page.getByRole('menuitem', { name: 'Award bonus' }).click();
  const dialog = page.getByRole('dialog', {
    name: `Award bonus — ${teamName}`,
  });
  await dialog.getByRole('button', { name: CATEGORY_LABELS[category] }).click();
  await dialog.getByLabel('Bonus points').fill(String(points));
  await dialog.getByRole('button', { name: 'Award' }).click();
  await expect(dialog).toHaveCount(0);
}

/** The Teams table row of the team shows these bonus and total points. */
export async function expectTeamsTablePoints(
  control: ControlScreen,
  teamName: string,
  bonusPoints: number,
  totalPoints: number,
): Promise<void> {
  const { page } = control;
  const table = page.getByRole('table').filter({
    has: page.getByRole('columnheader', { name: 'Bonus', exact: true }),
  });
  const headers = await table.getByRole('columnheader').allTextContents();
  const cells = table
    .getByRole('row')
    .filter({ hasText: teamName })
    .getByRole('cell');
  await expect(cells.nth(columnIndex(headers, 'Bonus'))).toHaveText(
    String(bonusPoints),
  );
  await expect(cells.nth(columnIndex(headers, 'Total'))).toHaveText(
    String(totalPoints),
  );
}

/** Where the column titled `title` sits in the table; fails the test if there is none. */
function columnIndex(headers: string[], title: string): number {
  const index = headers.findIndex((header) => header.trim() === title);
  expect(
    index,
    `Teams table column "${title}" in [${headers}]`,
  ).toBeGreaterThanOrEqual(0);
  return index;
}

/** The big screen's final leaderboard (this quiz has one break, which is its last) shows the team on the podium at `rank` with `points`. */
export async function expectPodiumEntry(
  display: DisplayScreen,
  teamName: string,
  points: number,
  rank: number,
): Promise<void> {
  const entry = display.page
    .getByRole('list', { name: 'Podium' })
    .getByRole('listitem')
    .filter({ hasText: teamName });
  await expect(entry).toHaveText(
    new RegExp(`${teamName}\\s*${points} pts\\s*${rank}\\.`),
  );
}

/** The phone shows the success toast for a new award, e.g. "🎉 +1 point — Selfie". */
export async function expectBonusToast(
  phone: PhoneScreen,
  toastText: string,
): Promise<void> {
  await expect(phone.page.getByText(toastText)).toBeVisible();
}

/** The phone shows no toast with that text. */
export async function expectNoBonusToast(
  phone: PhoneScreen,
  toastText: string,
): Promise<void> {
  await expect(phone.page.getByText(toastText)).toHaveCount(0);
}
