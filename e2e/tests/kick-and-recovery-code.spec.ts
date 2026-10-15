import { test } from '../fixtures';
import { QUIZ_NIGHT } from '../support/quiz-night';
import { startWithTwoTeams } from '../support/two-team-quiz';

const { freeText, choice } = QUIZ_NIGHT;
const WRONG_CAPITAL = 'Lyon';
const NAME_NEEDS_CODE = /already registered/;
const SEAT_HELD = /already connected on another device/;

test('a kicked team is told so and gets back in, answers intact, with its recovery code', async ({
  control,
  display,
  joinPhone,
  session,
}) => {
  // 1. Two teams join; Team A answers the first question.
  const { phoneA, phoneB } = await startWithTwoTeams(control, joinPhone);
  await phoneA.expectQuestion(freeText.prompt);
  await phoneA.submitText(WRONG_CAPITAL);
  await control.expectTeamAnswered(phoneA.teamName);
  await display.expectTeamCount(2);

  // 2. The quiz master reads Team A's recovery code (the table is gone once the team is kicked), then kicks it.
  const teamCode = await control.readTeamCode(phoneA.teamName);
  await control.kickTeam(phoneA.teamName);

  // 3. Team A is off the roster on /control and on the big screen; Team B is untouched.
  await control.expectTeams([phoneB.teamName]);
  await control.expectTeamGone(phoneA.teamName);
  await display.expectTeamCount(1);
  await control.expectTeamConnected(phoneB.teamName);

  // 4. Team A's phone is back on the join screen, told it was removed, with nothing prefilled.
  await phoneA.expectKicked();

  // 5. Its name alone is refused; with the recovery code the join goes through.
  await phoneA.pickQuiz(session.quizTitle);
  await phoneA.rejoin();
  await phoneA.expectJoinRefused(NAME_NEEDS_CODE);
  await control.expectTeamGone(phoneA.teamName);
  await phoneA.rejoin(teamCode);
  await phoneA.expectQuestion(freeText.prompt);
  await control.expectTeams([phoneA.teamName, phoneB.teamName]);
  await control.expectTeamConnected(phoneA.teamName);
  await display.expectTeamCount(2);

  // 6. The answer given before the kick is still on file, and the team can change it.
  await phoneA.expectSubmitted(WRONG_CAPITAL);
  await phoneA.submitText(freeText.key);
});

test("a teammate's second phone joins with the recovery code once the first phone has let go, and finds the team's answers", async ({
  control,
  joinPhone,
  openPhone,
}) => {
  // 1. Team A joins on phone 1 and answers the first question; the game moves on to the second.
  const phone1 = await joinPhone('Team A');
  await control.expectTeams([phone1.teamName]);
  await control.startQuiz();
  await control.advance('round_intro');
  await control.advance('question_open');
  await phone1.expectQuestion(freeText.prompt);
  await phone1.submitText(WRONG_CAPITAL);
  await control.advance('question_open');
  await phone1.expectQuestion(choice.prompt);
  const teamCode = await control.readTeamCode(phone1.teamName);

  // 2. Phone 2 (empty storage) tries the name and recovery code while phone 1 is still connected: refused, nothing handed over.
  const phone2 = await openPhone(phone1.teamName);
  await phone2.joinWithTeamCode(teamCode);
  await phone2.expectJoinRefused(SEAT_HELD);
  await control.expectTeamConnected(phone1.teamName);
  await phone1.submitChoice(choice.right);

  // 3. Phone 1 goes away (its browser closes); the team shows as disconnected.
  await phone1.close();
  await control.expectTeamConnected(phone1.teamName, false);

  // 4. Phone 2 tries again, takes the seat, and shows the current question and the answer already given.
  await phone2.pressJoin();
  await phone2.expectQuestion(choice.prompt);
  await control.expectTeamConnected(phone1.teamName);
  await phone2.expectSubmitted(choice.right);
  await phone2.openQuestion(1, 1);
  await phone2.expectSubmitted(WRONG_CAPITAL);
});
