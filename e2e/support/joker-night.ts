/**
 * What the joker-night journey needs beyond the shared screen objects: the
 * fixture's rounds, a seeded session with Jokers on, and the readings of the
 * pick, the joker chip, the border and the 2× stamp on the three screens.
 */
import path from 'node:path';
import { expect, type APIRequestContext } from '@playwright/test';
import type { SeededSession } from './api';
import { seedCsvSession } from './csv-session';
import { PATHS } from './env';
import type { ControlScreen } from './screens/control-screen';
import type { DisplayScreen } from './screens/display-screen';
import type { PhoneScreen } from './screens/phone-screen';

const JOKER_CSV = path.join(PATHS.e2eRoot, 'fixtures', 'joker-night.csv');

/** What `fixtures/joker-night.csv` holds: Warm-up and Music share the first block, Sport is the second. */
export const JOKER_NIGHT = {
  warmUp: {
    number: 1,
    title: 'Warm-up',
    prompt: 'What is the capital of France?',
    key: 'Paris',
    points: 2,
  },
  music: {
    number: 2,
    title: 'Music',
    prompt: 'Which band recorded Bohemian Rhapsody?',
    key: 'Queen',
    points: 3,
  },
  sport: { number: 3, title: 'Sport' },
  /** Round numbers that sit in the first block, the one the journey plays. */
  firstBlockRounds: [1, 2],
} as const;

/** A session with Jokers (and the round overview they build on) on, on its own copy of the joker-night quiz. */
export function seedJokerSession(
  api: APIRequestContext,
  quizTitle: string,
  lockGraceSeconds: number,
): Promise<SeededSession> {
  return seedCsvSession(api, JOKER_CSV, quizTitle, {
    lockGraceSeconds,
    showRoundOverview: true,
    jokersEnabled: true,
  });
}

/** The phone's joker chip, "🃏 R2" (with "· played" once the block was revealed). */
function jokerChip(phone: PhoneScreen) {
  return phone.page.getByRole('button', { name: /^🃏 R\d/ });
}

/** Taps the round's card in the picker and waits for the "Saved ✓" the server's acknowledgement raises. */
export async function pickJokerRound(
  phone: PhoneScreen,
  roundNumber: number,
): Promise<void> {
  const card = phone.page.getByRole('button', {
    name: new RegExp(`^ROUND ${roundNumber}\\b`),
  });
  await card.click();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await expect(phone.page.getByText('Saved ✓')).toBeVisible();
}

/** The big screen counts the picks without saying which round. */
export async function expectPickedCount(
  display: DisplayScreen,
  picked: number,
  teamCount: number,
): Promise<void> {
  await display.expectText(`${picked}/${teamCount} picked`);
}

/** The quiz master's Teams panel names the team's joker round and where it came from ("picked", "drawn"). */
export async function expectControlJoker(
  control: ControlScreen,
  teamName: string,
  jokerLine: string | RegExp,
): Promise<void> {
  await expect(
    control.page
      .locator('aside')
      .getByRole('listitem')
      .filter({ hasText: teamName })
      .getByText(jokerLine),
  ).toBeVisible();
}

/** The round number on the phone's joker chip, once the team has a joker. */
export async function readJokerRound(phone: PhoneScreen): Promise<number> {
  const chip = jokerChip(phone);
  await expect(chip).toBeVisible();
  const match = /^🃏 R(\d+)/.exec(await chip.innerText());
  if (!match) throw new Error('The joker chip does not name a round');
  return Number(match[1]);
}

/** Opens the joker chip and reads the round it says scores double. */
export async function expectJokerChipExplains(
  phone: PhoneScreen,
  roundNumber: number,
  roundTitle: string,
): Promise<void> {
  await jokerChip(phone).click();
  await expect(
    phone.page.getByText(`Round ${roundNumber} — ${roundTitle} scores double`),
  ).toBeVisible();
  await phone.page.getByRole('button', { name: 'Close joker' }).click();
}

/** The yellow joker border is on the question the phone shows (or is not). */
export async function expectJokerBorder(
  phone: PhoneScreen,
  isShown: boolean,
): Promise<void> {
  await expect(phone.page.getByTestId('joker-border')).toHaveCount(
    isShown ? 1 : 0,
  );
}

/** The team's leaderboard row on the big screen ends in its total, with the stamp's "2×" between the name and the points when it has one (`expectStandingsRow` would read that 2 as part of the name's digits). */
export async function expectStampedStandingsRow(
  display: DisplayScreen,
  teamName: string,
  points: number,
  isStamped: boolean,
): Promise<void> {
  const row = display.page
    .getByTestId('leaderboard-rows')
    .getByRole('listitem')
    .filter({ hasText: teamName });
  const stamp = isStamped ? '2×' : '';
  await expect(row).toHaveText(new RegExp(`${teamName}${stamp}${points}$`));
}

/** The "2×" stamp on the team's row of the big screen's leaderboard (or its absence). */
export async function expectDisplayStamp(
  display: DisplayScreen,
  teamName: string,
  isStamped: boolean,
): Promise<void> {
  await expect(
    display.page
      .getByTestId('leaderboard-rows')
      .getByRole('listitem')
      .filter({ hasText: teamName })
      .getByRole('img', { name: 'Joker 2×' }),
  ).toHaveCount(isStamped ? 1 : 0);
}

/** The "2×" stamp on the team's own row on its phone (or its absence). */
export async function expectPhoneStamp(
  phone: PhoneScreen,
  isStamped: boolean,
): Promise<void> {
  await expect(
    phone.page
      .getByTestId('own-leaderboard-row')
      .getByRole('img', { name: 'Joker 2×' }),
  ).toHaveCount(isStamped ? 1 : 0);
}
