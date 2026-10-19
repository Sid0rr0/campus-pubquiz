import { expect, test } from '../fixtures';
import { QUIZ_NIGHT } from '../support/quiz-night';
import { snap } from '../support/snapshots';

const { freeText, choice, audio } = QUIZ_NIGHT;

// Team A answers the key and picks the right planet: 2 + 3 points.
const TEAM_A_POINTS = freeText.points + choice.points;
// Team B's typed answer is graded half by the quiz master, and it picks the wrong planet.
const TEAM_B_POINTS = freeText.halfPoints;

// A longer lock countdown than the default, so all three screens can be snapshotted while it runs.
test.use({ sessionSettings: { lockGraceSeconds: 5 } });

test('a full block is played across the big screen, the laptop and two phones', async ({
  control,
  display,
  joinPhone,
}) => {
  // 1. The quiz master opens /control; the big screen shows the lobby.
  await control.expectTeams([]);

  // 2. Two teams join from two phones and both show up on the big screen and on /control.
  const phoneA = await joinPhone('Team A');
  const phoneB = await joinPhone('Team B');
  const teamNames = [phoneA.teamName, phoneB.teamName];
  await display.expectLobbyTeams(teamNames);
  await control.expectTeams(teamNames);
  await snap(display, 'lobby');
  await snap(phoneA, 'lobby');
  await snap(control, 'lobby');

  // 3. Rules and the round intro, then each question on the big screen and the phones.
  await control.startQuiz();
  await display.expectText('No cheating.');
  await phoneA.expectText('No cheating.');
  await snap(display, 'rules');
  await snap(phoneA, 'rules');
  await snap(control, 'rules');
  await control.advance('round_intro');
  await phoneA.expectText(QUIZ_NIGHT.roundOneTitle);
  await display.expectText(QUIZ_NIGHT.roundOneTitle);
  await snap(display, 'round_intro');
  await snap(phoneA, 'round_intro');
  await snap(control, 'round_intro');

  await control.advance('question_open');
  await display.expectQuestion(freeText.prompt);
  await phoneA.expectQuestion(freeText.prompt);
  await phoneB.expectQuestion(freeText.prompt);

  // 4. Team A answers the key. Team B answers something else, then changes it: the last answer stands.
  await phoneA.submitText(freeText.key);
  await phoneB.submitText('Lyon');
  await phoneB.submitText('Marseille');
  await control.expectTeamAnswered(phoneA.teamName);
  await control.expectTeamAnswered(phoneB.teamName);
  await display.expectAnsweredCount(2, 2);
  await snap(display, 'question_open');
  await snap(phoneA, 'question_open');
  await snap(control, 'question_open');

  await control.advance('question_open');
  await display.expectQuestion(choice.prompt);
  await phoneA.expectQuestion(choice.prompt);
  await phoneA.submitChoice(choice.right);
  await phoneB.expectQuestion(choice.prompt);
  await phoneB.submitChoice(choice.wrong);

  await control.advance('round_intro');
  await control.advance('question_open');
  await display.expectQuestion(audio.prompt);
  await display.expectAudioPlayer(audio.mediaUrl);
  await display.expectAudioLoaded();

  // 5. The block locks after the short countdown, and the phones can no longer change their answers.
  await control.advance('locking');
  await display.expectLockCountdown();
  await snap(display, 'locking');
  await snap(phoneA, 'locking');
  await snap(control, 'locking');
  await control.expectStatus('break_intro');
  await display.expectBreak(1);
  await snap(display, 'break_intro');
  await snap(phoneA, 'break_intro');
  await snap(control, 'break_intro');
  await phoneB.openQuestion(1, 1);
  await phoneB.expectAnswersLocked();
  await phoneB.expectSubmitted('Marseille');

  // 6. In the break, the quiz master grades Team B's typed answer.
  await control.selectQuestion(QUIZ_NIGHT.roundOneTitle, 1);
  await expect(control.answerRow(phoneB.teamName)).toContainText('Marseille');
  await expect(control.answerRow(phoneB.teamName)).not.toContainText('Lyon');
  await expect(control.answerRow(phoneA.teamName)).toContainText(freeText.key);
  await control.grade(phoneB.teamName, 'half points');
  await expect(
    control.answerRow(phoneB.teamName).getByRole('button', {
      name: `Grade ${phoneB.teamName} half points`,
    }),
  ).toHaveText(`✓ Half (${freeText.halfPoints})`);

  // 7. The reveal shows the answers; the standings match the expected points.
  await control.advance('reveal_intro');
  await display.expectText('REVEALING ANSWERS');
  await snap(display, 'reveal_intro');
  await snap(phoneA, 'reveal_intro');
  await snap(control, 'reveal_intro');
  await control.advance('reveal');
  await display.expectQuestion(freeText.prompt);
  await display.expectRevealedAnswer(freeText.key);
  await phoneA.expectRevealedAnswer(freeText.key);
  await phoneA.expectRevealedPoints(freeText.points, freeText.points);
  await phoneB.expectRevealedAnswer('Marseille');
  await phoneB.expectRevealedPoints(freeText.halfPoints, freeText.points);
  await snap(display, 'reveal');
  await snap(phoneA, 'reveal');
  await snap(control, 'reveal');

  await control.advance('reveal');
  await display.expectQuestion(choice.prompt);
  await display.expectRevealedAnswer(choice.right);
  await phoneA.expectRevealedPoints(choice.points, choice.points);
  await phoneB.expectRevealedAnswer(choice.wrong);
  await phoneB.expectRevealedPoints(0, choice.points);

  await control.advance('reveal_intro');
  await control.advance('reveal');
  await display.expectQuestion(audio.prompt);

  await control.toggleLeaderboard();
  await control.revealNextLeaderboardTeam();
  await display.expectLeaderboardRow(phoneB.teamName, TEAM_B_POINTS);
  await phoneB.expectOwnStanding(TEAM_B_POINTS);
  await control.revealNextLeaderboardTeam();
  await display.expectLeaderboardRow(phoneA.teamName, TEAM_A_POINTS);
  await phoneA.expectOwnStanding(TEAM_A_POINTS);
});
