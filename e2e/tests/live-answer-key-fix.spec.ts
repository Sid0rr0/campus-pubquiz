import { randomUUID } from 'node:crypto';
import { expect, test as base } from '../fixtures';
import {
  ANSWER_KEY_FIX,
  fixAnswerKey,
  importAnswerKeyFixQuiz,
} from '../support/answer-key-fix';
import { createSession, type SeededSession } from '../support/api';
import { ADMIN_STORAGE_STATE } from '../support/env';
import { startWithTwoTeams } from '../support/two-team-quiz';

const { choice, freeText } = ANSWER_KEY_FIX;

// Once the multiple-choice key is corrected, Team A (Mars) is right and Team B (Venus) is wrong.
const TEAM_A_POINTS = choice.points + freeText.points;
const TEAM_B_POINTS = 0;

// This journey runs on its own two-question quiz, whose multiple-choice key starts out wrong.
const test = base.extend<{ session: SeededSession }>({
  session: async ({ adminApi, sessionSettings }, use) => {
    const quizTitle = `Key fix ${randomUUID().slice(0, 6)}`;
    const quizId = await importAnswerKeyFixQuiz(adminApi, quizTitle);
    const joinCode = await createSession(
      adminApi,
      quizId,
      quizTitle,
      sessionSettings,
    );
    await use({ joinCode, quizId, quizTitle });
  },
});

test("correcting a shown question's answer key re-scores the phones and the standings", async ({
  adminApi,
  control,
  display,
  joinPhone,
  newContext,
  session,
}) => {
  // The presenter's phone on /remote, logged in as the quiz master.
  const remoteContext = await newContext({ storageState: ADMIN_STORAGE_STATE });
  const remote = await remoteContext.newPage();
  await remote.goto(`/remote?code=${session.joinCode}`);
  const upNext = remote
    .locator('section')
    .filter({ has: remote.getByRole('heading', { name: 'Up next' }) });
  await expect(upNext).toBeVisible();

  // 1. Team A picks the right planet, which the typo'd key marks wrong; Team B picks the typo'd key.
  const { phoneA, phoneB } = await startWithTwoTeams(control, joinPhone);
  await phoneA.expectQuestion(choice.prompt);
  await phoneA.submitChoice(choice.rightKey);
  await phoneB.submitChoice(choice.wrongKey);

  // 2. Team A also types the capital correctly; the block locks into the break.
  await control.advance('question_open');
  await phoneA.expectQuestion(freeText.prompt);
  await phoneA.submitText(freeText.key);
  await control.advance('locking');
  await control.expectStatus('break_intro');
  await expect(upNext).not.toContainText('Waiting for grading');

  // 3. In the break the quiz master saves the corrected planet.
  await fixAnswerKey(adminApi, session.quizId, choice.prompt, choice.rightKey);

  // 4. A fix that makes Team A's typed answer ungraded holds the Advance slot back, on /remote and /control.
  const notYetGraded = control.page.getByRole('button', {
    name: /^Grade question 2 of .* \(not yet graded\)$/,
  });
  await expect(notYetGraded).toHaveCount(0);
  await fixAnswerKey(
    adminApi,
    session.quizId,
    freeText.prompt,
    freeText.otherKey,
  );
  await expect(upNext).toContainText('Waiting for grading');
  await expect(notYetGraded).toBeVisible();

  // 5. Putting the key back clears the last ungraded answer, and the wait ends.
  await fixAnswerKey(adminApi, session.quizId, freeText.prompt, freeText.key);
  await expect(upNext).not.toContainText('Waiting for grading');
  await expect(notYetGraded).toHaveCount(0);

  // 6. The reveal shows the re-scored answers: Team A, once wrong, is now right, and Team B the reverse.
  await control.advance('reveal_intro');
  await control.advance('reveal');
  await display.expectQuestion(choice.prompt);
  await display.expectRevealedAnswer(choice.rightKey);
  await phoneA.expectRevealedAnswer(choice.rightKey);
  await phoneA.expectRevealedPoints(choice.points, choice.points);
  await phoneB.expectRevealedAnswer(choice.wrongKey);
  await phoneB.expectRevealedPoints(0, choice.points);

  await control.advance('reveal');
  await display.expectQuestion(freeText.prompt);
  await phoneA.expectRevealedPoints(freeText.points, freeText.points);

  // 7. The standings follow: Team A leads with both questions, Team B has nothing.
  await control.toggleLeaderboard();
  await control.revealNextLeaderboardTeam();
  await display.expectLeaderboardRow(phoneB.teamName, TEAM_B_POINTS);
  await phoneB.expectOwnStanding(TEAM_B_POINTS);
  await control.revealNextLeaderboardTeam();
  await display.expectLeaderboardRow(phoneA.teamName, TEAM_A_POINTS);
  await phoneA.expectOwnStanding(TEAM_A_POINTS);
});
