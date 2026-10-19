import fs from 'node:fs';
import path from 'node:path';
import { expect, type APIRequestContext } from '@playwright/test';
import type { ControlScreen } from './screens/control-screen';
import type { PhoneScreen } from './screens/phone-screen';
import { recordMove, type Move } from './coverage';
import { PATHS } from './env';
import type { SeededSession } from './api';

const KAHOOT_CSV = path.join(PATHS.e2eRoot, 'fixtures', 'kahoot-round.csv');

/** What `fixtures/kahoot-round.csv` holds: one kahoot round of two multiple-choice questions. */
export const KAHOOT_ROUND = {
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

export interface KahootSessionOptions {
  /** Seconds a kahoot question stays open before it locks by itself; null for no timer. */
  kahootQuestionTimerSeconds: number | null;
  lockGraceSeconds: number;
}

interface PreviewResponse {
  isImportable: boolean;
  issues: unknown[];
  rounds: object[];
}

/**
 * Imports the kahoot CSV as a new quiz with its round switched to kahoot mode
 * (no CSV column sets it) and creates a session on it.
 */
export async function seedKahootSession(
  api: APIRequestContext,
  quizTitle: string,
  options: KahootSessionOptions,
): Promise<SeededSession> {
  const csvText = fs.readFileSync(KAHOOT_CSV, 'utf8');
  const previewResponse = await api.post('/import/preview', {
    data: { csvText, quizTitle },
  });
  expect(previewResponse.ok(), 'import preview').toBe(true);
  const preview = (await previewResponse.json()) as PreviewResponse;
  expect(preview.issues, 'import issues').toEqual([]);
  expect(preview.isImportable).toBe(true);

  const rounds = preview.rounds.map((round) => ({
    ...round,
    kahootMode: true,
  }));
  const saveResponse = await api.post('/quizzes', {
    data: { title: quizTitle, rounds },
  });
  expect(saveResponse.ok(), `save quiz: ${await saveResponse.text()}`).toBe(
    true,
  );
  const { quizId } = (await saveResponse.json()) as { quizId: number };

  const sessionResponse = await api.post('/sessions', {
    data: { quizId, name: quizTitle, settings: options },
  });
  expect(
    sessionResponse.ok(),
    `create session: ${await sessionResponse.text()}`,
  ).toBe(true);
  const { joinCode } = (await sessionResponse.json()) as { joinCode: string };
  return { joinCode, quizId, quizTitle };
}

/** A kahoot choice is sent the moment it is tapped (there is no Submit button); resolves once the server has saved it. */
export async function answerKahootChoice(
  phone: PhoneScreen,
  option: string,
): Promise<void> {
  await phone.page.getByRole('button', { name: option, exact: true }).click();
  await phone.expectSubmitted(option);
}

/**
 * The session moves to `status` with nobody pressing anything: a timer ran out.
 * Records the `move` the timer is (the kahoot question timer is a
 * `phase_timer`, the lock countdown an `auto_advance`).
 */
export async function expectTimerMove(
  control: ControlScreen,
  status: string,
  move: Extract<Move, 'auto_advance' | 'phase_timer'>,
): Promise<void> {
  await control.expectStatus(status);
  recordMove(move);
}
