import { expect, test } from '../fixtures/restartable-backend';
import { QUIZ_NIGHT } from '../support/quiz-night';
import { startWithTwoTeams } from '../support/two-team-quiz';

const { freeText, choice } = QUIZ_NIGHT;
const WRONG_CAPITAL = 'Lyon';
const HALF_CREDIT_ANSWER = 'Marseille';
// Longer than the 1-2 seconds the other journeys use: stopping the backend, waiting for every screen to notice
// and starting it again takes several seconds, and the test asserts the block is still locking once it is back.
const RESTART_LOCK_GRACE_SECONDS = 10;

// Team A: the key (changed from a wrong answer) and the right planet. Team B: a half-credit answer and the wrong planet.
const TEAM_A_POINTS = freeText.points + choice.points;
const TEAM_B_POINTS = freeText.halfPoints;

test('a backend restart mid-block leaves every screen resynced, answers intact, and the game carries on', async ({
  restartableBackend,
  control,
  display,
  joinPhone,
}) => {
  // 1. Two teams join; the quiz master opens two questions and both teams answer both.
  const { phoneA, phoneB } = await startWithTwoTeams(control, joinPhone);
  await phoneA.submitText(WRONG_CAPITAL);
  await phoneB.submitText(HALF_CREDIT_ANSWER);
  await control.advance('question_open');
  await display.expectQuestion(choice.prompt);
  await phoneA.submitChoice(choice.right);
  await phoneB.submitChoice(choice.wrong);

  // 2. The backend goes away: every screen shows it has lost its connection.
  await restartableBackend.stop();
  await control.expectReconnecting();
  await phoneA.expectReconnecting();
  await phoneB.expectReconnecting();
  await display.expectReconnecting();

  // 3. The backend comes back on the same port and database: nothing is reloaded, nothing is lost.
  await restartableBackend.start();
  await control.expectNoConnectionWarning();
  await control.expectStatus('question_open');
  await control.expectTeams([phoneA.teamName, phoneB.teamName]);
  await control.expectTeamConnected(phoneA.teamName);
  await control.expectTeamConnected(phoneB.teamName);
  await display.expectQuestion(choice.prompt);
  await phoneA.expectQuestion(choice.prompt);
  await phoneB.expectQuestion(choice.prompt);
  await phoneA.expectSubmitted(choice.right);
  await phoneB.expectSubmitted(choice.wrong);
  await phoneA.openQuestion(1, 1);
  await phoneA.expectSubmitted(WRONG_CAPITAL);
  await phoneB.openQuestion(1, 1);
  await phoneB.expectSubmitted(HALF_CREDIT_ANSWER);

  // 4. The game carries on: Team A changes its answer, the block locks, the quiz master grades.
  await phoneA.submitText(freeText.key);
  await control.advance('round_intro');
  await control.advance('question_open');
  await control.advance('locking');
  await control.expectStatus('break_intro');
  await display.expectBreak(1);
  await phoneA.openQuestion(1, 1);
  await phoneA.expectAnswersLocked();
  await phoneA.expectSubmitted(freeText.key);

  await control.selectQuestion(QUIZ_NIGHT.roundOneTitle, 1);
  await expect(control.answerRow(phoneB.teamName)).toContainText(
    HALF_CREDIT_ANSWER,
  );
  await control.grade(phoneB.teamName, 'half points');

  // 5. The reveal and the standings match the points earned.
  await control.advance('reveal_intro');
  await control.advance('reveal');
  await phoneA.expectRevealedPoints(freeText.points, freeText.points);
  await phoneB.expectRevealedPoints(freeText.halfPoints, freeText.points);
  await control.advance('reveal');
  await phoneA.expectRevealedPoints(choice.points, choice.points);
  await phoneB.expectRevealedPoints(0, choice.points);
  await control.advance('reveal_intro');
  await control.advance('reveal');
  await control.toggleLeaderboard();
  await control.pressAdvanceSlot();
  await display.expectLeaderboardRow(phoneB.teamName, TEAM_B_POINTS);
  await phoneB.expectOwnStanding(TEAM_B_POINTS);
  await control.pressAdvanceSlot();
  await display.expectLeaderboardRow(phoneA.teamName, TEAM_A_POINTS);
  await phoneA.expectOwnStanding(TEAM_A_POINTS);
});

test.describe('restart while the block is locking', () => {
  test.use({
    sessionSettings: { lockGraceSeconds: RESTART_LOCK_GRACE_SECONDS },
  });

  test('the lock deadline is re-armed and the block still locks', async ({
    restartableBackend,
    control,
    display,
    joinPhone,
  }) => {
    // 1. Both teams answer the first question; the quiz master opens the last one and starts locking.
    const { phoneA, phoneB } = await startWithTwoTeams(control, joinPhone);
    await phoneA.submitText(freeText.key);
    await phoneB.submitText(HALF_CREDIT_ANSWER);
    await control.advance('question_open');
    await control.advance('round_intro');
    await control.advance('question_open');
    await control.advance('locking');
    await display.expectLockCountdown();

    // 2. The backend restarts while the countdown is running.
    await restartableBackend.stop();
    await control.expectReconnecting();
    await phoneA.expectReconnecting();
    await display.expectReconnecting();
    await restartableBackend.start();

    // 3. The restart finished inside the grace window: the game is still locking and the countdown still runs.
    await control.expectNoConnectionWarning();
    await control.expectStatus('locking');
    await display.expectLockCountdown();

    // 4. The block still locks: the break starts without anyone pressing a button.
    await control.expectStatus('break_intro');
    await phoneA.openQuestion(1, 1);
    await phoneA.expectAnswersLocked();
    await phoneA.expectSubmitted(freeText.key);
    await phoneB.openQuestion(1, 1);
    await phoneB.expectAnswersLocked();
    await phoneB.expectSubmitted(HALF_CREDIT_ANSWER);

    // 5. Grading, the reveal and the standings work after the restart.
    await control.selectQuestion(QUIZ_NIGHT.roundOneTitle, 1);
    await control.grade(phoneB.teamName, 'half points');
    await control.advance('reveal_intro');
    await control.advance('reveal');
    await phoneA.expectRevealedPoints(freeText.points, freeText.points);
    await phoneB.expectRevealedPoints(freeText.halfPoints, freeText.points);
    await control.toggleLeaderboard();
    await control.pressAdvanceSlot();
    await display.expectLeaderboardRow(phoneB.teamName, freeText.halfPoints);
    await control.pressAdvanceSlot();
    await display.expectLeaderboardRow(phoneA.teamName, freeText.points);
  });
});
