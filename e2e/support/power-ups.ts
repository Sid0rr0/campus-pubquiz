/**
 * What the power-up journeys need beyond the shared screen objects: the
 * fixture's questions, a seeded session with power-ups on, and the phone's shop
 * drawer. Effects a single journey reads live in its own helpers.
 */
import path from 'node:path';
import { expect, type APIRequestContext, type Locator } from '@playwright/test';
import type { SeededSession, SessionSettingsInput } from './api';
import { recordMove } from './coverage';
import { seedCsvSession } from './csv-session';
import type { ControlScreen } from './screens/control-screen';
import { PATHS } from './env';
import type { PhoneScreen } from './screens/phone-screen';

const POWER_UPS_CSV = path.join(PATHS.e2eRoot, 'fixtures', 'power-ups.csv');

/** What `fixtures/power-ups.csv` holds: Helps and Doubles are one block each. */
export const POWER_UP_NIGHT = {
  helps: {
    number: 1,
    title: 'Helps',
    multipleChoice: {
      prompt: 'Which planet is known as the Red Planet?',
      key: 'Mars',
    },
    freeText: { prompt: 'What is the capital of France?', key: 'Paris' },
    sort: { prompt: 'Put these planets in order from the Sun' },
    match: { prompt: 'Match each country to its capital' },
    numeric: { prompt: 'How many pence are two pounds?', key: 200 },
  },
  doubles: {
    number: 2,
    title: 'Doubles',
    prompt: 'Which sport uses a shuttlecock?',
    key: 'Badminton',
    points: 3,
  },
} as const;

/** A session with power-ups on, on its own copy of the power-up-night quiz. */
export function seedPowerUpSession(
  api: APIRequestContext,
  quizTitle: string,
  settings: SessionSettingsInput,
): Promise<SeededSession> {
  return seedCsvSession(api, POWER_UPS_CSV, quizTitle, {
    powerUpsEnabled: true,
    ...settings,
  });
}

/** The trigger of the phone's shop drawer, whose name carries the balance ("Power-ups (2 coins)"). */
function shopTrigger(phone: PhoneScreen) {
  return phone.page.getByRole('button', { name: /^Power-ups \(\d+ coins?\)$/ });
}

/** The phone's balance reads `coins`. */
export async function expectCoins(
  phone: PhoneScreen,
  coins: number,
): Promise<void> {
  await expect(shopTrigger(phone)).toHaveAccessibleName(
    `Power-ups (${coins} ${coins === 1 ? 'coin' : 'coins'})`,
  );
}

/** Opens the shop drawer and resolves with it. */
export async function openShop(phone: PhoneScreen) {
  await shopTrigger(phone).click();
  const drawer = phone.page.getByRole('dialog', { name: 'Power-ups' });
  await expect(drawer).toBeVisible();
  return drawer;
}

/** Gives (or, negative, takes) `coins` from `teamName` through the award form on /control, with no points, and waits for the form to close. */
export async function awardCoins(
  control: ControlScreen,
  teamName: string,
  coins: number,
): Promise<void> {
  const { page } = control;
  await page.getByRole('button', { name: `Actions for ${teamName}` }).click();
  await page.getByRole('menuitem', { name: 'Award bonus' }).click();
  const dialog = page.getByRole('dialog', {
    name: `Award bonus — ${teamName}`,
  });
  await dialog.getByLabel('Coin award').fill(String(coins));
  await dialog.getByRole('button', { name: 'Award' }).click();
  await expect(dialog).toHaveCount(0);
  recordMove('coin_award');
}

/** The Coins column of the Teams table shows `coins` on the team's row. */
export async function expectTeamsTableCoins(
  control: ControlScreen,
  teamName: string,
  coins: number,
): Promise<void> {
  const { page } = control;
  const table = page.getByRole('table').filter({
    has: page.getByRole('columnheader', { name: 'Coins', exact: true }),
  });
  const headers = (await table.getByRole('columnheader').allTextContents()).map(
    (header) => header.trim(),
  );
  const index = headers.indexOf('Coins');
  expect(index, `Coins column in [${headers}]`).toBeGreaterThanOrEqual(0);
  await expect(
    table
      .getByRole('row')
      .filter({ hasText: teamName })
      .getByRole('cell')
      .nth(index),
  ).toHaveText(String(coins));
}

/** Buys the extra joker from the open shop drawer for the offered round and records the move; the drawer closes once the server has accepted it. */
export async function buyExtraJoker(drawer: Locator): Promise<void> {
  await drawer.getByRole('button', { name: 'Activate Extra joker' }).click();
  await expect(drawer).toHaveCount(0);
  recordMove('power_up_extra_joker');
}

/** Buys the power-up (by its label, "50/50") from the shop; the drawer closes once the server has accepted it. */
export async function buyPowerUp(
  phone: PhoneScreen,
  label: string,
): Promise<void> {
  const drawer = await openShop(phone);
  await drawer.getByRole('button', { name: `Activate ${label}` }).click();
  await expect(drawer).toHaveCount(0);
}
