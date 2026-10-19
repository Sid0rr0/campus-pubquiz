import { randomUUID } from 'node:crypto';
import { expect, test } from '../fixtures';
import { ADMIN_STORAGE_STATE } from '../support/env';
import { takeLoginSlot } from '../support/login-budget';
import { QUIZ_NIGHT } from '../support/quiz-night';
import { ControlScreen } from '../support/screens/control-screen';
import { MODERATOR_PASSWORD, registerPendingUser } from '../support/users';

const { freeText, choice, audio } = QUIZ_NIGHT;

test('the admin approves a moderator, who logs in and runs a block from /control', async ({
  playwright,
  newContext,
  session,
  joinPhone,
}) => {
  const moderatorName = `mod-${randomUUID().slice(0, 6)}`;
  await registerPendingUser(
    playwright.request,
    moderatorName,
    MODERATOR_PASSWORD,
  );

  // 1. The admin sees the new account under "Pending approval" and approves it as a moderator.
  const adminPage = await (
    await newContext({ storageState: ADMIN_STORAGE_STATE })
  ).newPage();
  await adminPage.goto('/users');
  const pendingRow = adminPage
    .getByRole('listitem')
    .filter({ hasText: moderatorName });
  await expect(pendingRow).toBeVisible();
  await pendingRow
    .getByLabel(`Role for ${moderatorName}`)
    .selectOption('moderator');
  await pendingRow.getByRole('button', { name: 'Approve' }).click();
  const activeRow = adminPage
    .getByRole('listitem')
    .filter({ hasText: moderatorName });
  await expect(activeRow.getByText('moderator', { exact: true })).toBeVisible();
  await expect(
    activeRow.getByRole('button', { name: 'Deactivate' }),
  ).toBeVisible();

  // 2. The moderator logs in through the login page (the login is limited, so it waits for a slot).
  await takeLoginSlot();
  const moderatorPage = await (await newContext()).newPage();
  await moderatorPage.goto('/login');
  await moderatorPage.getByLabel('Username').fill(moderatorName);
  await moderatorPage
    .getByLabel('Password', { exact: true })
    .fill(MODERATOR_PASSWORD);
  await moderatorPage.getByRole('button', { name: 'Log in' }).click();
  await expect(moderatorPage).toHaveURL(/\/sessions$/);

  // 3. What a moderator can't do is not offered, and the Users page turns them away.
  const header = moderatorPage.getByRole('banner');
  await expect(header.getByText(moderatorName)).toBeVisible();
  await expect(header.getByRole('link', { name: 'Sessions' })).toBeVisible();
  await expect(moderatorPage.getByRole('link', { name: 'Users' })).toHaveCount(
    0,
  );
  await moderatorPage
    .getByRole('button', { name: `Actions for ${session.quizTitle}` })
    .click();
  await expect(
    moderatorPage.getByRole('menuitem', { name: 'Edit' }),
  ).toBeVisible();
  await expect(
    moderatorPage.getByRole('menuitem', { name: 'Delete' }),
  ).toHaveCount(0);
  await moderatorPage.keyboard.press('Escape');

  await moderatorPage.goto('/users');
  // The page sends a moderator to /control, which with no session pinned lands on /sessions.
  await expect(moderatorPage).toHaveURL(/\/sessions$/);
  await expect(
    moderatorPage.getByRole('heading', { name: 'Users' }),
  ).toHaveCount(0);

  // 4. The moderator opens the admin's session from the running list: /control, with teams on the lobby.
  await moderatorPage.goto('/sessions');
  await moderatorPage
    .getByRole('listitem')
    .filter({ hasText: session.joinCode })
    .getByRole('button', { name: 'Control' })
    .click();
  await expect(moderatorPage).toHaveURL(/\/control\?code=/);
  const control = new ControlScreen(moderatorPage, session.joinCode);
  await control.expectStatus('lobby');

  const phone = await joinPhone('Team M');
  await control.expectTeams([phone.teamName]);

  // 5. The moderator advances through the block; the socket accepts the moderator's actions.
  await control.startQuiz();
  await control.advance('round_intro');
  await control.advance('question_open');
  await phone.expectQuestion(freeText.prompt);
  await phone.submitText('Marseille');
  await control.expectTeamAnswered(phone.teamName);
  await control.advance('question_open');
  await phone.expectQuestion(choice.prompt);
  await phone.submitChoice(choice.right);
  await control.advance('round_intro');
  await control.advance('question_open');
  await phone.expectQuestion(audio.prompt);
  await control.advance('locking');
  await control.expectStatus('break_intro');

  // 6. The moderator grades the typed answer by hand and reveals it.
  await control.selectQuestion(QUIZ_NIGHT.roundOneTitle, 1);
  await expect(control.answerRow(phone.teamName)).toContainText('Marseille');
  await control.grade(phone.teamName, 'half points');
  await expect(
    control
      .answerRow(phone.teamName)
      .getByRole('button', { name: `Grade ${phone.teamName} half points` }),
  ).toHaveText(`✓ Half (${freeText.halfPoints})`);
  await control.advance('reveal_intro');
  await control.advance('reveal');
  await phone.expectRevealedAnswer('Marseille');
  await phone.expectRevealedPoints(freeText.halfPoints, freeText.points);
});
