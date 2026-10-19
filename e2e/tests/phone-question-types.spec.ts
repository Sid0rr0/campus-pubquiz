import { expect, test as base } from '../fixtures';
import { recordMove } from '../support/coverage';
import { seedCsvSession } from '../support/csv-session';
import { PHONE_QUESTION_TYPES } from '../support/phone-question-types';
import {
  dragMatchItem,
  tapMoveUp,
  tapNumberAnswer,
  tapSubmit,
} from '../support/screens/phone-touch-answers';
import { snap } from '../support/snapshots';

const { roundTitle, sort, match, number, closestGuess } = PHONE_QUESTION_TYPES;

const test = base.extend({
  session: async ({ adminApi, sessionSettings }, use) => {
    const quizTitle = `Phone types ${Date.now().toString(36)}`;
    await use(
      await seedCsvSession(
        adminApi,
        PHONE_QUESTION_TYPES.csvPath,
        quizTitle,
        sessionSettings,
      ),
    );
  },
});

const arrows = (items: readonly string[]) => items.join(' → ');
const pairs = (lefts: readonly string[], rights: readonly string[]) =>
  lefts.map((left, index) => `${left} → ${rights[index]}`).join(', ');

// Team A reaches every key from one touch gesture; team B submits each question as the phone first showed it
// (or, for the two numeric ones, a guess that is wrong or farther away).
const TEAM_A_POINTS =
  sort.points + match.points + number.points + closestGuess.points;

test('sort, match, number and closest guess are answered by touch and revealed', async ({
  control,
  display,
  joinPhone,
}) => {
  const phoneA = await joinPhone('Team A');
  const phoneB = await joinPhone('Team B');
  await control.expectTeams([phoneA.teamName, phoneB.teamName]);
  await control.startQuiz();
  await control.advance('round_intro');

  // 1. Sort: team A taps "Move up" once, team B submits the starting order.
  await control.advance('question_open');
  await display.expectQuestion(sort.prompt);
  await phoneA.expectQuestion(sort.prompt);
  await phoneB.expectQuestion(sort.prompt);
  await snap(phoneA, 'question_open', 'sort');
  await tapMoveUp(phoneA, sort.itemToMoveUp);
  await tapSubmit(phoneA, arrows(sort.keyOrder));
  await tapSubmit(phoneB, arrows(sort.startOrder));
  await control.expectTeamAnswered(phoneA.teamName);
  await control.expectTeamAnswered(phoneB.teamName);

  // 2. Match: team A drags one right-hand item with a finger, team B submits the starting pairs.
  await control.advance('question_open');
  await display.expectQuestion(match.prompt);
  await phoneA.expectQuestion(match.prompt);
  await phoneB.expectQuestion(match.prompt);
  await snap(phoneA, 'question_open', 'match');
  await dragMatchItem(
    phoneA,
    match.itemToDrag,
    match.dropOnto,
    match.keyRights,
  );
  await tapSubmit(phoneA, pairs(match.lefts, match.keyRights));
  await tapSubmit(phoneB, pairs(match.lefts, match.startRights));
  await control.expectTeamAnswered(phoneA.teamName);
  await control.expectTeamAnswered(phoneB.teamName);

  // 3. Number: the question says how close an answer must be.
  await control.advance('question_open');
  await display.expectQuestion(number.prompt);
  await display.expectText(number.marginText);
  await phoneA.expectQuestion(number.prompt);
  await phoneA.expectText(number.marginText);
  await phoneB.expectQuestion(number.prompt);
  await snap(phoneA, 'question_open', 'number');
  await tapNumberAnswer(phoneA, number.rightGuess);
  await tapNumberAnswer(phoneB, number.wrongGuess);
  await control.expectTeamAnswered(phoneA.teamName);
  await control.expectTeamAnswered(phoneB.teamName);

  // 4. Closest guess: both teams guess, the closer one wins at reveal.
  await control.advance('question_open');
  await display.expectQuestion(closestGuess.prompt);
  await phoneA.expectQuestion(closestGuess.prompt);
  await phoneB.expectQuestion(closestGuess.prompt);
  await snap(phoneA, 'question_open', 'closest-guess');
  await tapNumberAnswer(phoneA, closestGuess.closerGuess);
  await tapNumberAnswer(phoneB, closestGuess.fartherGuess);
  await control.expectTeamAnswered(phoneA.teamName);
  await control.expectTeamAnswered(phoneB.teamName);

  // 5. In the break /control lists both teams' answers for each question.
  await control.advance('locking');
  await control.expectStatus('break_intro');
  await control.selectQuestion(roundTitle, 1);
  await expect(control.answerRow(phoneA.teamName)).toContainText(
    arrows(sort.keyOrder),
  );
  await expect(control.answerRow(phoneB.teamName)).toContainText(
    arrows(sort.startOrder),
  );
  await control.selectQuestion(roundTitle, 2);
  await expect(control.answerRow(phoneA.teamName)).toContainText(
    pairs(match.lefts, match.keyRights),
  );
  await expect(control.answerRow(phoneB.teamName)).toContainText(
    pairs(match.lefts, match.startRights),
  );
  await control.selectQuestion(roundTitle, 3);
  await expect(control.answerRow(phoneA.teamName)).toContainText(
    number.rightGuess,
  );
  await expect(control.answerRow(phoneB.teamName)).toContainText(
    number.wrongGuess,
  );
  await control.selectQuestion(roundTitle, 4);
  await expect(control.answerRow(phoneA.teamName)).toContainText(
    closestGuess.closerGuess,
  );
  await expect(control.answerRow(phoneB.teamName)).toContainText(
    closestGuess.fartherGuess,
  );

  // 6. Reveal. Sort: the key on the big screen, each team's own order on its phone.
  await control.advance('reveal_intro');
  await control.advance('reveal');
  await display.expectQuestion(sort.prompt);
  await expect(display.page.getByRole('listitem')).toHaveText(
    sort.keyOrder.map((item, index) => new RegExp(`${index + 1}\\s*${item}`)),
  );
  await snap(display, 'reveal', 'sort');
  await phoneA.expectRevealedAnswer(arrows(sort.keyOrder));
  await phoneA.expectRevealedPoints(sort.points, sort.points);
  await phoneB.expectRevealedAnswer(arrows(sort.startOrder));
  await phoneB.expectRevealedPoints(0, sort.points);

  // Match: the key pairs on the big screen.
  await control.advance('reveal');
  await display.expectQuestion(match.prompt);
  for (const [index, left] of match.lefts.entries()) {
    await expect(
      display.page.getByRole('listitem').filter({ hasText: left }).last(),
    ).toContainText(match.keyRights[index]);
  }
  await snap(display, 'reveal', 'match');
  await phoneA.expectRevealedAnswer(pairs(match.lefts, match.keyRights));
  await phoneA.expectRevealedPoints(match.points, match.points);
  await phoneB.expectRevealedAnswer(pairs(match.lefts, match.startRights));
  await phoneB.expectRevealedPoints(1, match.points);

  // Number: the key and the range it accepts.
  await control.advance('reveal');
  await display.expectQuestion(number.prompt);
  await display.expectRevealedAnswer(number.acceptedRange);
  await snap(display, 'reveal', 'number');
  await phoneA.expectRevealedAnswer(number.rightGuess);
  await phoneA.expectRevealedPoints(number.points, number.points);
  await phoneB.expectRevealedAnswer(number.wrongGuess);
  await phoneB.expectRevealedPoints(0, number.points);

  // Closest guess: one line per press of Advance, on the big screen and on the phones.
  await control.advance('reveal');
  await display.expectQuestion(closestGuess.prompt);
  await control.pressAdvanceSlot();
  recordMove('closest_guess_reveal');
  const smallest = new RegExp(`SMALLEST GUESS\\s*${closestGuess.closerGuess}`);
  await expect(display.page.getByText(smallest)).toBeVisible();
  await expect(phoneA.page.getByText(smallest)).toBeVisible();
  await expect(display.page.getByText(/ANSWER\s*\d/)).toHaveCount(0);

  await control.pressAdvanceSlot();
  await expect(
    display.page.getByText(
      new RegExp(`HIGHEST GUESS\\s*${closestGuess.fartherGuess}`),
    ),
  ).toBeVisible();

  await control.pressAdvanceSlot();
  const answerLine = new RegExp(`ANSWER\\s*${closestGuess.key}`);
  await expect(display.page.getByText(answerLine)).toBeVisible();
  await expect(phoneA.page.getByText(answerLine)).toBeVisible();

  await control.pressAdvanceSlot();
  await expect(display.page.getByRole('listitem')).toContainText([
    new RegExp(`${phoneA.teamName}.*${closestGuess.closerGuess}`),
  ]);
  await snap(display, 'reveal', 'closest-guess');
  await phoneA.expectRevealedAnswer(closestGuess.closerGuess);
  await phoneA.expectRevealedPoints(closestGuess.points, closestGuess.points);
  await phoneB.expectRevealedAnswer(closestGuess.fartherGuess);
  await phoneB.expectRevealedPoints(0, closestGuess.points);

  // The standings add the four questions up.
  await control.toggleLeaderboard();
  await control.revealNextLeaderboardTeam();
  await display.expectLeaderboardRow(phoneB.teamName, 1);
  await control.revealNextLeaderboardTeam();
  await display.expectLeaderboardRow(phoneA.teamName, TEAM_A_POINTS);
});
