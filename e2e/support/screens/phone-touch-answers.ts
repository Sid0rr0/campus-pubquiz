import { expect, type Locator, type Page } from '@playwright/test';
import type { PhoneScreen } from './phone-screen';

/** Intermediate touch-move points of a drag, so dnd-kit sees a gesture rather than a jump. */
const DRAG_STEPS = 12;

interface Point {
  x: number;
  y: number;
}

async function centerOf(locator: Locator): Promise<Point> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('Cannot drag: the element has no box on screen');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** One finger pressed on `from`, dragged to `to` and lifted, as real touch events (Playwright's own touchscreen can only tap). */
async function touchDrag(page: Page, from: Point, to: Point): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const send = (
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      point?: Point,
    ) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: point ? [point] : [],
      });
    await send('touchStart', from);
    for (let step = 1; step <= DRAG_STEPS; step++) {
      const progress = step / DRAG_STEPS;
      await send('touchMove', {
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
      });
    }
    await send('touchEnd');
  } finally {
    await cdp.detach();
  }
}

/** Taps Submit (touch) and waits until the phone shows the server's copy of the answer. */
export async function tapSubmit(
  phone: PhoneScreen,
  submittedText: string,
): Promise<void> {
  const submit = phone.page.getByRole('button', {
    name: 'Submit',
    exact: true,
  });
  // The first tap after a finger drag can be swallowed by the drag library's click guard, so tap again until the server has the answer.
  await expect(async () => {
    if (await submit.isVisible()) await submit.tap({ timeout: 2_000 });
    await expect(
      phone.page.getByText(`Submitted: ${submittedText}`),
    ).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

/** Taps a sort item's "Move up" button `times` times. */
export async function tapMoveUp(
  phone: PhoneScreen,
  item: string,
  times = 1,
): Promise<void> {
  const button = phone.page.getByRole('button', { name: `Move ${item} up` });
  for (let tapCount = 0; tapCount < times; tapCount++) {
    await button.tap();
  }
}

/** Drags a match question's right-hand `item` onto the place of `target` with a finger, and waits for the column to settle in the new order. */
export async function dragMatchItem(
  phone: PhoneScreen,
  item: string,
  target: string,
  rightsAfter: readonly string[],
): Promise<void> {
  const handle = (name: string) =>
    phone.page.getByRole('button', { name: `Drag to reorder ${name}` });
  await touchDrag(
    phone.page,
    await centerOf(handle(item)),
    await centerOf(handle(target)),
  );
  const rightColumn = phone.page.locator('ol').getByRole('listitem');
  await expect(rightColumn).toHaveText([...rightsAfter]);
}

/** Types a number (touch focus, number keypad field) and taps Submit. */
export async function tapNumberAnswer(
  phone: PhoneScreen,
  value: string,
): Promise<void> {
  const input = phone.page.getByLabel('Your answer');
  await input.tap();
  await input.fill(value);
  await tapSubmit(phone, value);
}
