import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { test as base, expect } from '../fixtures';
import { seedCsvSession } from '../support/csv-session';
import { E2E_LOCK_GRACE_SECONDS, PATHS } from '../support/env';
import { JOKER_NIGHT } from '../support/joker-night';
import {
  expectSideBar,
  expectSideCount,
  joinIntoPicker,
  NO_SIDE_REFUSAL,
  pickSide,
  VERSUS_NIGHT,
  VERSUS_SETTINGS,
} from '../support/versus-night';

const { warmUp, music } = JOKER_NIGHT;
const { engineering, law } = VERSUS_NIGHT;

// Engineering fields Team A (both right: 5) and Team C (answers wrong: 0), Law fields Team B (one right: 2).
// Averages: Engineering 2.5, Law 2 -> 56% / 44%.
const BAR_AFTER_BLOCK = [
  { name: engineering.name, average: '2.5', percent: '56%' },
  { name: law.name, average: '2', percent: '44%' },
];

const test = base.extend({
  session: async ({ adminApi }, use) => {
    const quizTitle = `Versus night ${randomUUID().slice(0, 6)}`;
    await use(
      await seedCsvSession(
        adminApi,
        path.join(PATHS.e2eRoot, 'fixtures', 'joker-night.csv'),
        quizTitle,
        { lockGraceSeconds: E2E_LOCK_GRACE_SECONDS, ...VERSUS_SETTINGS },
      ),
    );
  },
});

test('a Versus night: teams pick sides, Start is refused until all have one, the bar splits by average and the ended screen names the winner', async ({
  session,
  control,
  display,
  openPhone,
}) => {
  const suffix = randomUUID().slice(0, 6);
  const phoneA = await openPhone(`Team A ${suffix}`);
  const phoneB = await openPhone(`Team B ${suffix}`);
  const phoneC = await openPhone(`Team C ${suffix}`);

  // 1. Joining lands on the side picker; the lobby counts follow the picks.
  for (const phone of [phoneA, phoneB, phoneC]) {
    await joinIntoPicker(phone, session.joinCode);
  }
  await pickSide(phoneA, engineering.name);
  await pickSide(phoneB, law.name);
  await expectSideCount(display.page, engineering.name, 1);
  await expectSideCount(display.page, law.name, 1);

  // 2. Team C has no side yet, so Start quiz is refused.
  await control.page
    .locator('aside')
    .getByRole('button', { name: 'Start Quiz' })
    .click();
  await expect(control.page.getByText(NO_SIDE_REFUSAL).first()).toBeVisible();
  await control.expectStatus('lobby');

  await pickSide(phoneC, engineering.name);
  await expectSideCount(display.page, engineering.name, 2);
  await expectSideCount(display.page, law.name, 1);
  await control.startQuiz();

  // 3. The first block: A answers both right, B only the first, C answers wrong.
  await control.advance('round_intro');
  await control.advance('question_open');
  await phoneA.submitText(warmUp.key);
  await phoneB.submitText(warmUp.key);
  await phoneC.submitText('Lyon');
  await control.advance('round_intro');
  await control.advance('question_open');
  await phoneA.submitText(music.key);
  await control.advance('locking');
  await control.expectStatus('break_intro');
  // The break needs C's non-matching typed answer graded before the reveal.
  await control.selectQuestion(warmUp.title, 1);
  await control.grade(phoneC.teamName, '0 points');
  await control.advance('reveal_intro');
  await control.advance('reveal');
  await control.advance('reveal_intro');
  await control.advance('reveal');

  // 4. The leaderboard: the bar shows the split on the big screen and the phone.
  await control.toggleLeaderboard();
  for (let ranks = 0; ranks < 3; ranks++) {
    await control.revealNextLeaderboardTeam();
  }
  await display.expectLeaderboardRow(
    phoneA.teamName,
    warmUp.points + music.points,
  );
  await expect(display.page.getByTestId('side-dot')).toHaveCount(3);
  await expectSideBar(display.page, BAR_AFTER_BLOCK);
  await expectSideBar(phoneA.page, BAR_AFTER_BLOCK);
  await expect(
    phoneA.page.locator('[data-testid="side-bar"] [data-own="true"]'),
  ).toContainText(`${engineering.name} (you)`);
  await expect(
    phoneB.page.locator('[data-testid="side-bar"] [data-own="true"]'),
  ).toContainText(`${law.name} (you)`);

  // 5. The ended screen names the winner.
  await control.page
    .locator('aside')
    .getByRole('button', { name: 'End Quiz' })
    .click();
  await control.page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'End Quiz', exact: true })
    .click();
  await control.expectStatus('ended');
  await expect(
    display.page.getByText(`${engineering.name} wins`),
  ).toBeVisible();
});
