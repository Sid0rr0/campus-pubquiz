/**
 * Quiz-master moves the full-night journey needs that the screen objects don't
 * have yet: Previous, the join overlay and a bonus award. Each records its
 * move for the coverage reporter where it is one.
 */
import { expect } from '@playwright/test';
import { recordMove } from './coverage';
import type { ControlScreen } from './screens/control-screen';
import type { DisplayScreen } from './screens/display-screen';

async function pressPrevious(
  control: ControlScreen,
  expectedStatus: string,
): Promise<void> {
  await control.page
    .locator('aside')
    .getByRole('button', { name: 'Previous', exact: true })
    .click();
  await control.expectStatus(expectedStatus);
}

/** Previous while walking a block's break review backward. */
export async function previousInBreakReview(
  control: ControlScreen,
  expectedStatus: string,
): Promise<void> {
  await pressPrevious(control, expectedStatus);
  recordMove('previous_break_review');
}

/** Previous from the first round card of a block's break review, back into the earlier block's reveal. */
export async function previousAcrossBlock(
  control: ControlScreen,
  expectedStatus: string,
): Promise<void> {
  await pressPrevious(control, expectedStatus);
  recordMove('previous_across_block');
}

/** Presses the Join overlay button and waits for it to show the new state. */
export async function toggleJoinOverlay(
  control: ControlScreen,
  isShownAfter: boolean,
): Promise<void> {
  const button = control.page
    .locator('aside')
    .getByRole('button', { name: 'Join overlay', exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', String(isShownAfter));
  recordMove('join_overlay');
}

/** The team's leaderboard row on the big screen ends in `points`; a trend mark may sit between the name and the points once the board has a history. */
export async function expectStandingsRow(
  display: DisplayScreen,
  teamName: string,
  points: number,
): Promise<void> {
  const row = display.page
    .getByTestId('leaderboard-rows')
    .getByRole('listitem')
    .filter({ hasText: teamName });
  await expect(row).toHaveText(new RegExp(`${teamName}\\D*${points}$`));
}

/** The final board puts every top-three team on a podium step instead of in the list. */
export async function expectPodiumStep(
  display: DisplayScreen,
  teamName: string,
  points: number,
): Promise<void> {
  const step = display.page
    .getByTestId('podium')
    .getByRole('listitem')
    .filter({ hasText: teamName });
  await expect(step).toContainText(`${points} pts`);
}

/** Awards the team the default one-point bonus of `categoryLabel` ("Shot" or "Selfie") from the Teams table. */
export async function awardBonus(
  control: ControlScreen,
  teamName: string,
  categoryLabel: 'Shot' | 'Selfie',
): Promise<void> {
  const { page } = control;
  await page.getByRole('button', { name: `Actions for ${teamName}` }).click();
  await page.getByRole('menuitem', { name: 'Award bonus' }).click();
  const dialog = page.getByRole('dialog', {
    name: `Award bonus — ${teamName}`,
  });
  await dialog.getByRole('button', { name: categoryLabel }).click();
  await dialog.getByRole('button', { name: 'Award' }).click();
  await expect(dialog).toHaveCount(0);
}
