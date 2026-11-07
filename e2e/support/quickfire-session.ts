import path from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import type { ControlScreen } from './screens/control-screen';
import type { PhoneScreen } from './screens/phone-screen';
import { recordMove, type Move, type Status } from './coverage';
import { seedCsvSession } from './csv-session';
import { PATHS } from './env';
import type { SeededSession } from './api';

const QUICKFIRE_CSV = path.join(
  PATHS.e2eRoot,
  'fixtures',
  'quickfire-round.csv',
);

/** What `fixtures/quickfire-round.csv` holds: one quickfire round of two multiple-choice questions. */
export const QUICKFIRE_ROUND = {
  title: 'Quick fire',
  first: {
    prompt: 'Which planet is known as the Red Planet?',
    right: 'Mars',
    wrong: 'Venus',
    points: 3,
  },
  second: {
    prompt: 'Which ocean is the largest?',
    right: 'Pacific',
    wrong: 'Atlantic',
    points: 3,
  },
} as const;

export interface QuickfireSessionOptions {
  /** Seconds a quickfire question stays open before it locks by itself; null for no timer. */
  quickfireQuestionTimerSeconds: number | null;
  lockGraceSeconds: number;
}

/**
 * Imports the quickfire CSV as a new quickfire-mode quiz (previewed with mode
 * quickfire; no CSV column sets it) and creates a session on it.
 */
export function seedQuickfireSession(
  api: APIRequestContext,
  quizTitle: string,
  options: QuickfireSessionOptions,
): Promise<SeededSession> {
  return seedCsvSession(api, QUICKFIRE_CSV, quizTitle, options, 'quickfire');
}

/** A quickfire choice is sent the moment it is tapped (there is no Submit button); resolves once the server has saved it. */
export async function answerQuickfireChoice(
  phone: PhoneScreen,
  option: string,
): Promise<void> {
  await phone.page.getByRole('button', { name: option, exact: true }).click();
  await phone.expectSubmitted(option);
}

/**
 * The session moves to `status` with nobody pressing anything: a timer ran out.
 * Records the `move` the timer is (the quickfire question timer is a
 * `phase_timer`, the lock countdown an `auto_advance`).
 */
export async function expectTimerMove(
  control: ControlScreen,
  status: Status,
  move: Extract<Move, 'auto_advance' | 'phase_timer'>,
): Promise<void> {
  await control.expectStatus(status);
  recordMove(move);
}
