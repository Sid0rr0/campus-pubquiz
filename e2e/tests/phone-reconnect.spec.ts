import { test } from '../fixtures';
import { QUIZ_NIGHT } from '../support/quiz-night';
import { startWithTwoTeams } from '../support/two-team-quiz';

const { freeText, choice } = QUIZ_NIGHT;
const WRONG_CAPITAL = 'Lyon';

test('a reloaded phone gets its team, its answers and the current question back', async ({
  control,
  joinPhone,
}) => {
  // 1. Two teams join and the quiz master opens the first question.
  const { phoneA, phoneB } = await startWithTwoTeams(control, joinPhone);
  await phoneA.expectQuestion(freeText.prompt);

  // 2. Team A answers the first question wrongly, then the game moves on to the second.
  await phoneA.submitText(WRONG_CAPITAL);
  await control.advance('question_open');
  await phoneA.expectQuestion(choice.prompt);

  // 3. Team A's phone reloads and comes back without typing anything.
  await phoneA.reload();
  await phoneA.expectQuestion(choice.prompt);
  await control.expectTeamConnected(phoneA.teamName);
  await control.expectTeamConnected(phoneB.teamName);

  // 4. The earlier answer is still on file.
  await phoneA.openQuestion(1, 1);
  await phoneA.expectSubmitted(WRONG_CAPITAL);

  // 5. Team A changes its mind after the reload; the new answer stands through locking and grading.
  await phoneA.submitText(freeText.key);
  await phoneB.submitChoice(choice.wrong);
  await control.advance('round_intro');
  await control.advance('question_open');
  await control.advance('locking');
  await control.expectStatus('break_intro');
  await phoneA.openQuestion(1, 1);
  await phoneA.expectAnswersLocked();
  await phoneA.expectSubmitted(freeText.key);

  await control.advance('reveal_intro');
  await control.advance('reveal');
  await phoneA.expectRevealedAnswer(freeText.key);
  await phoneA.expectRevealedPoints(freeText.points, freeText.points);
});

test('a phone that goes offline while the game moves on shows the current question when it is back', async ({
  control,
  joinPhone,
}) => {
  // 1. Two teams join; the quiz master opens the first question.
  const { phoneA, phoneB } = await startWithTwoTeams(control, joinPhone);
  await phoneA.expectQuestion(freeText.prompt);
  await phoneA.submitText(freeText.key);

  // 2. Team A's phone loses its connection; the quiz master moves on meanwhile.
  await phoneA.setOffline(true);
  await control.advance('question_open');
  await phoneB.expectQuestion(choice.prompt);
  await phoneA.expectQuestion(freeText.prompt);

  // 3. The connection returns: the phone catches up, still knows its team and answer.
  await phoneA.setOffline(false);
  await phoneA.expectQuestion(choice.prompt);
  await control.expectTeamConnected(phoneA.teamName);
  await phoneA.openQuestion(1, 1);
  await phoneA.expectSubmitted(freeText.key);
  await phoneA.openQuestion(1, 2);
  await phoneA.submitChoice(choice.right);
});
