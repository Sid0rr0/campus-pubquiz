import { expect, type APIRequestContext } from '@playwright/test';
import type { PhoneScreen } from './screens/phone-screen';

/** The part of `GET /stats/sessions` a journey reads. */
interface PlayedSessionsResponse {
  items: { gameSessionId: number; joinCode: string }[];
}

const STAR_COUNT = 5;
const MAX_PAGE_SIZE = 100;

/** The star row of a round on the phone's break card or final form. */
function roundRow(phone: PhoneScreen, roundTitle: string) {
  return phone.page.getByRole('listitem').filter({
    has: phone.page.getByRole('button', {
      name: `Rate ${roundTitle} 1 of ${STAR_COUNT}`,
    }),
  });
}

/** Taps `stars` on the round's row and waits until the server has saved it ("Saved ✓"). */
export async function rateRound(
  phone: PhoneScreen,
  roundTitle: string,
  stars: number,
): Promise<void> {
  const row = roundRow(phone, roundTitle);
  await row
    .getByRole('button', {
      name: `Rate ${roundTitle} ${stars} of ${STAR_COUNT}`,
      exact: true,
    })
    .click();
  await expectRoundRating(phone, roundTitle, stars);
}

/** The round's row shows exactly `stars` stars as the server's saved rating. */
export async function expectRoundRating(
  phone: PhoneScreen,
  roundTitle: string,
  stars: number,
): Promise<void> {
  const row = roundRow(phone, roundTitle);
  await expect(row.getByText('Saved ✓')).toBeVisible();
  await expect(
    row.getByRole('button', {
      name: `Rate ${roundTitle} ${stars} of ${STAR_COUNT}`,
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true');
}

/** Fills "Anything else?" and the topic lines of the final form, presses Send and waits for "Sent ✓". */
export async function sendFeedback(
  phone: PhoneScreen,
  comment: string,
  topics: readonly string[],
): Promise<void> {
  const { page } = phone;
  await page.getByLabel('Anything else?').fill(comment);
  for (const [index, topic] of topics.entries()) {
    if (index > 0)
      await page.getByRole('button', { name: '+ Add another' }).click();
    await page.getByLabel(`Topic ${index + 1}`).fill(topic);
  }
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('Sent ✓')).toBeVisible();
}

/** The stats id of the session with this join code (an ended session is listed there, newest first). */
export async function findPlayedSessionId(
  api: APIRequestContext,
  joinCode: string,
): Promise<number> {
  const response = await api.get(
    `/stats/sessions?page=1&pageSize=${MAX_PAGE_SIZE}&sortBy=playedAt&sortOrder=desc`,
  );
  expect(response.ok(), 'list played sessions').toBe(true);
  const { items } = (await response.json()) as PlayedSessionsResponse;
  const played = items.find((item) => item.joinCode === joinCode);
  if (!played) throw new Error(`Session ${joinCode} is not in the stats list`);
  return played.gameSessionId;
}
