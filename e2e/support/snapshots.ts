/**
 * Whole-screen assertions: `snap(screen, status)`.
 *
 *   await snap(display, 'break_intro');
 *   await snap(phoneA, 'reveal');
 *   await snap(control, 'question_open', 'kahoot');   // optional variant
 *
 * - `screen` is a DisplayScreen, PhoneScreen or ControlScreen.
 * - It compares the page's ARIA structure with a snapshot file, retrying like
 *   any assertion, and records the cell `<screen>:<status>` as visited for the
 *   coverage reporter (coverage.ts). Call it when the screen has reached
 *   `status`; it records nothing if the snapshot does not match.
 * - The file is `<spec>-snapshots/<screen>-<status>[-<variant>].aria.yml`. A
 *   second snap of the same cell in one spec file needs its own `variant`
 *   (e.g. the other phone: `snap(phoneB, 'reveal', 'team-b')`).
 * - Matching is by containment: extra elements on the page pass, a missing
 *   one fails. `--update-snapshots` (re)writes the file; it then holds this
 *   run's literal team names, join codes, recovery codes, timers and
 *   counters, so replace each with a regex (`/Team A [a-z0-9]{6}/`) before
 *   committing. A session-specific value left literal fails on the next run.
 * - Values that must be right (points, standings, answers) keep their own
 *   hand assertions; the snapshot only guards the structure.
 */
import { expect, type Page } from '@playwright/test';
import { recordCell, type Screen, type Status } from './coverage';

/** What `snap` needs from a screen object (the three screen classes have it). */
export interface SnapScreen {
  readonly kind: Screen;
  readonly page: Page;
}

export async function snap(
  screen: SnapScreen,
  status: Status,
  variant?: string,
): Promise<void> {
  const name = [screen.kind, status, variant].filter(Boolean).join('-');
  await expect(screen.page.locator('body')).toMatchAriaSnapshot({
    name: `${name}.aria.yml`,
  });
  recordCell(screen.kind, status);
}
