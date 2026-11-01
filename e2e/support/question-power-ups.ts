/**
 * The question power-ups journey's own helpers: a purchase that records its
 * coverage move, and the readings of what each effect does to the answer form.
 */
import { expect } from '@playwright/test';
import type { Move } from './coverage';
import { buyPowerUp, closeShop, openShop } from './power-ups';
import type { PhoneScreen } from './screens/phone-screen';

/** The question power-ups, by the label the shop shows and the move they record. */
export const QUESTION_POWER_UPS = {
  fiftyFifty: { label: '50/50', move: 'power_up_fifty_fifty' },
  firstLetter: { label: 'First letter', move: 'power_up_first_letter' },
  letterCount: { label: 'Letter count', move: 'power_up_letter_count' },
  pinOne: { label: 'Pin one', move: 'power_up_pin_one' },
  widerMargin: { label: 'Wider margin', move: 'power_up_wider_margin' },
} as const satisfies Record<string, { label: string; move: Move }>;

/** The full table with the pin allowed on both the sort and the match (one use is the default); costs are the defaults. */
export const POWER_UP_TABLE_WITH_TWO_PINS = {
  fifty_fifty: { cost: 2, maxUses: 1 },
  first_letter: { cost: 2, maxUses: 1 },
  letter_count: { cost: 1, maxUses: 1 },
  pin_one: { cost: 2, maxUses: 2 },
  wider_margin: { cost: 2, maxUses: 1 },
  ask_the_room: { cost: 3, maxUses: 1 },
  extra_joker: { cost: 5, maxUses: 1 },
};

/** Coins the journey spends: 2 + 2 + 1 + 2 + 2 + 2. */
export const QUESTION_POWER_UPS_COINS = 11;

export async function buyQuestionPowerUp(
  phone: PhoneScreen,
  powerUp: (typeof QUESTION_POWER_UPS)[keyof typeof QUESTION_POWER_UPS],
): Promise<void> {
  await buyPowerUp(phone, powerUp.label, powerUp.move);
}

/** Opens the shop for a snapshot and closes it again. */
export async function peekAtShop(
  phone: PhoneScreen,
  whileOpen: () => Promise<void>,
): Promise<void> {
  const drawer = await openShop(phone);
  await whileOpen();
  await closeShop(phone, drawer);
}

/** Which of the multiple-choice options the phone greys out. */
export async function disabledOptions(
  phone: PhoneScreen,
  options: readonly string[],
): Promise<string[]> {
  const disabled: string[] = [];
  for (const option of options) {
    const button = phone.page.getByRole('button', {
      name: option,
      exact: true,
    });
    if (await button.isDisabled()) disabled.push(option);
  }
  return disabled;
}

/** The item the pin holds in place on a sort or match question, once exactly one 📌 shows and exactly one drag handle is disabled. */
export async function pinnedItem(phone: PhoneScreen): Promise<string> {
  const pin = phone.page.getByTitle('Pinned in place');
  await expect(pin).toHaveCount(1);
  await expect(
    phone.page.locator('button[aria-label^="Drag to reorder "]:disabled'),
  ).toHaveCount(1);
  const row = phone.page.getByRole('listitem').filter({ has: pin }).last();
  return (await row.innerText()).replace('📌', '').trim();
}
