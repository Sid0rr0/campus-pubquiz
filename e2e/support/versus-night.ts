/**
 * What the Versus-night journey needs beyond the shared screen objects: the
 * two sides, a phone that joins into the side picker, and readings of the
 * side picker, lobby counts and side bar on the three screens.
 */
import { expect, type Page } from '@playwright/test';
import type { SessionSettingsInput } from './api';
import type { PhoneScreen } from './screens/phone-screen';

export const VERSUS_NIGHT = {
  engineering: { id: 'eng', name: 'Engineering' },
  law: { id: 'law', name: 'Law' },
} as const;

export const VERSUS_SETTINGS: Pick<
  SessionSettingsInput,
  'versusEnabled' | 'versusSides'
> = {
  versusEnabled: true,
  versusSides: [VERSUS_NIGHT.engineering, VERSUS_NIGHT.law],
};

/** The message Start Quiz is refused with while a team has no side. */
export const NO_SIDE_REFUSAL =
  'Every team needs a side before the quiz can start';

/** Joins the team's form and waits for the side picker that covers the phone (joining does not take a side). */
export async function joinIntoPicker(
  phone: PhoneScreen,
  joinCode: string,
): Promise<void> {
  await phone.page.goto(`/play?code=${joinCode}`);
  await phone.page.getByLabel('Team name').fill(phone.teamName);
  await phone.pressJoin();
  await expect(
    phone.page.getByRole('heading', { name: 'Pick your side' }),
  ).toBeVisible();
}

/** Taps the side's card; the picker closes and the lobby shows. */
export async function pickSide(
  phone: PhoneScreen,
  sideName: string,
): Promise<void> {
  await phone.page.getByRole('button', { name: sideName, exact: true }).click();
  await expect(phone.page.getByText("You're in!")).toBeVisible();
}

/** The big-screen lobby counts the teams on a side. */
export async function expectSideCount(
  page: Page,
  sideName: string,
  teamCount: number,
): Promise<void> {
  await expect(page.getByTestId('side-counts')).toContainText(
    `${sideName}: ${teamCount} ${teamCount === 1 ? 'team' : 'teams'}`,
  );
}

/** The side bar names each side with its average and percentage. */
export async function expectSideBar(
  page: Page,
  sides: readonly { name: string; average: string; percent: string }[],
): Promise<void> {
  const bar = page.getByTestId('side-bar');
  for (const side of sides) {
    // The phone's own side carries a " (you)" after its name.
    await expect(bar).toContainText(
      new RegExp(
        `${side.name}( \\(you\\))?${side.average} pts avg · ${side.percent}`,
      ),
    );
  }
}
