/**
 * Helpers for the showdown journey: the small quiz it plays, a session on that
 * quiz, and the showdown moves on /control and the phones.
 */
import path from 'node:path';
import { expect, type APIRequestContext } from '@playwright/test';
import { recordMove } from './coverage';
import { importCsvQuiz } from './csv-session';
import { PATHS } from './env';
import type { ControlScreen } from './screens/control-screen';
import type { DisplayScreen } from './screens/display-screen';
import type { PhoneScreen } from './screens/phone-screen';

/** What `fixtures/showdown.csv` holds: one `free_text` question both teams answer correctly, so they tie. */
export const SHOWDOWN_NIGHT = {
  roundTitle: 'Tie night',
  question: {
    prompt: 'What is the capital of France?',
    key: 'Paris',
    points: 2,
  },
} as const;

/** The tiebreaker the quiz master types up: a number to guess. */
export const TIEBREAKER = {
  question: 'How many seats does this room have?',
  answer: 42,
  points: 1,
} as const;

const SHOWDOWN_CSV = path.join(PATHS.e2eRoot, 'fixtures', 'showdown.csv');

/** Imports `fixtures/showdown.csv` as a quiz titled `quizTitle` and returns its id. */
export function importShowdownNight(
  api: APIRequestContext,
  quizTitle: string,
): Promise<number> {
  return importCsvQuiz(api, SHOWDOWN_CSV, quizTitle);
}

/** The quiz master types up the tiebreaker in the Showdown panel and saves it. */
export async function createShowdown(
  control: ControlScreen,
  tiebreaker: { question: string; answer: number; points: number },
): Promise<void> {
  const { page } = control;
  await page
    .locator('aside')
    .getByRole('button', { name: 'Create showdown' })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Question').fill(tiebreaker.question);
  await dialog.getByLabel('Answer').fill(String(tiebreaker.answer));
  await dialog.getByLabel('Points').fill(String(tiebreaker.points));
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
}

/** The big screen's podium lists the team with `points` and its place ("1.", "2." or "1.–2." for a tie). */
export async function expectPodiumPlace(
  display: DisplayScreen,
  teamName: string,
  points: number,
  place: string,
): Promise<void> {
  const escapedPlace = place.replace(/\./g, '\\.');
  await expect(
    display.page
      .getByRole('list', { name: 'Podium' })
      .getByRole('listitem')
      .filter({ hasText: teamName }),
  ).toContainText(new RegExp(`${points}\\s*pts\\s*${escapedPlace}`));
}

/** The team names in seat order, as the big screen lists them. */
export async function readSeatOrder(display: DisplayScreen): Promise<string[]> {
  const names = await display.page
    .locator('main li > span:first-child')
    .allTextContents();
  expect(names.length, 'showdown participants').toBeGreaterThanOrEqual(2);
  return names;
}

/** The phone is asked for its guess ("Your turn!") and the form is open. */
export async function expectGuessForm(phone: PhoneScreen): Promise<void> {
  await expect(phone.page.getByText('Your turn!')).toBeVisible();
  await expect(phone.page.getByLabel('Your guess')).toBeVisible();
}

/** Types the guess on the phone and presses Submit; resolves once the phone waits for the other teams. */
export async function submitShowdownGuess(
  phone: PhoneScreen,
  guess: number,
): Promise<void> {
  await phone.page.getByLabel('Your guess').fill(String(guess));
  await phone.page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(phone.page.getByText(`Your guess: ${guess}`)).toBeVisible();
  await expect(phone.page.getByText('Waiting for other teams…')).toBeVisible();
}

/** The Teams-independent showdown panel lists the team as having guessed. */
export async function expectGuessed(
  control: ControlScreen,
  teamName: string,
): Promise<void> {
  await expect(
    control.page
      .locator('aside li')
      .filter({ hasText: teamName })
      .getByText('guessed', { exact: true }),
  ).toHaveCount(1);
}

/** Presses Advance once: the next team's turn in the seat order is revealed (the last press shows the answer). */
export async function advanceShowdownTurn(
  control: ControlScreen,
): Promise<void> {
  await control.pressAdvanceSlot();
  recordMove('showdown_turn');
}
