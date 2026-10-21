import { expect, test } from '../fixtures';
import { endQuiz, findRowAcrossPages } from '../support/admin-pages';
import { QUIZ_NIGHT } from '../support/quiz-night';
import { startWithTwoTeams } from '../support/two-team-quiz';

const { freeText } = QUIZ_NIGHT;

test('after a short played session, /sessions, /stats and /teams show its data', async ({
  control,
  joinPhone,
  session,
}) => {
  // 1. A short session: two teams, one question, Team A answers the key, then the quiz master ends it.
  const { phoneA, phoneB } = await startWithTwoTeams(control, joinPhone);
  await phoneA.submitText(freeText.key);
  await control.expectTeamAnswered(phoneA.teamName);
  await endQuiz(control);
  const page = control.page;

  // 2. /sessions lists the session as ended, with its join code and both teams.
  await page.goto('/sessions');
  await expect(
    page.getByRole('heading', { name: 'Quiz Sessions' }),
  ).toBeVisible();
  const sessionItem = page
    .getByRole('listitem')
    .filter({ hasText: session.joinCode });
  await expect(sessionItem).toContainText(session.quizTitle);
  await expect(sessionItem).toContainText(
    new RegExp(`ended\\s+·\\s+2 teams\\s+·\\s+${session.joinCode}`),
  );

  // 3. /stats lists it as a played session with its winner, and the detail page shows the standings.
  await page.goto('/stats');
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
  const playedRow = await findRowAcrossPages(page, session.quizTitle);
  await expect(playedRow.getByRole('cell').nth(2)).toHaveText('2');
  await expect(playedRow).toContainText(
    `${freeText.points} — ${phoneA.teamName}`,
  );
  await playedRow.getByRole('link', { name: session.quizTitle }).click();
  await expect(page).toHaveURL(/\/stats\/\d+/);
  // The Scoresheet further down has a row per team too, so look only at the standings.
  const standings = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Standings' }) });
  const winnerRow = standings
    .getByRole('row')
    .filter({ hasText: phoneA.teamName });
  await expect(winnerRow).toContainText('Winner');
  await expect(winnerRow.getByRole('cell').first()).toHaveText('1.');
  await expect(
    standings
      .getByRole('row')
      .filter({ hasText: phoneB.teamName })
      .getByRole('cell')
      .first(),
  ).toHaveText('2.');

  // 4. /teams lists both teams with one session played and their average placing.
  await page.goto('/teams');
  await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible();
  const teamARow = await findRowAcrossPages(page, phoneA.teamName);
  await expect(teamARow.getByRole('cell').nth(3)).toHaveText('1');
  await expect(teamARow.getByRole('cell').nth(4)).toHaveText('1.0');
  const teamBRow = await findRowAcrossPages(page, phoneB.teamName);
  await expect(teamBRow.getByRole('cell').nth(3)).toHaveText('1');
  await expect(teamBRow.getByRole('cell').nth(4)).toHaveText('2.0');
});
