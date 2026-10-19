import { randomUUID } from 'node:crypto';
import { expect, test as base } from '../fixtures';
import { createSession } from '../support/api';
import {
  advanceShowdownTurn,
  createShowdown,
  expectGuessForm,
  expectPodiumPlace,
  expectGuessed,
  importShowdownNight,
  readSeatOrder,
  SHOWDOWN_NIGHT,
  submitShowdownGuess,
  TIEBREAKER,
} from '../support/showdown';
import { snap } from '../support/snapshots';

const { question } = SHOWDOWN_NIGHT;
// The closer guess wins the showdown's point on top of the tied score.
const WINNER_GUESS = TIEBREAKER.answer - 2;
const LOSER_GUESS = TIEBREAKER.answer + 8;
const WINNER_POINTS = question.points + TIEBREAKER.points;
const LOSER_POINTS = question.points;
const TIED_POINTS = question.points;

// The session is created on the showdown quiz instead of the quiz-night one.
const test = base.extend({
  session: async ({ adminApi, sessionSettings }, use) => {
    const quizTitle = `Showdown night ${randomUUID().slice(0, 6)}`;
    const quizId = await importShowdownNight(adminApi, quizTitle);
    const joinCode = await createSession(
      adminApi,
      quizId,
      quizTitle,
      sessionSettings,
    );
    await use({ joinCode, quizId, quizTitle });
  },
});

test.use({ sessionSettings: { lockGraceSeconds: 1 } });

test('two tied teams play a showdown, taking their turns in seat order, until one wins', async ({
  control,
  display,
  joinPhone,
}) => {
  // 1. Both teams answer the only question correctly, so they end tied on 2 points.
  const phoneA = await joinPhone('Team A');
  const phoneB = await joinPhone('Team B');
  await control.expectTeams([phoneA.teamName, phoneB.teamName]);
  await control.startQuiz();
  await control.advance('round_intro');
  await control.advance('question_open');
  await phoneA.submitText(question.key);
  await phoneB.submitText(question.key);
  await control.advance('locking');
  await control.expectStatus('break_intro');
  await control.advance('reveal_intro');
  await control.advance('reveal');
  await display.expectRevealedAnswer(question.key);
  await phoneA.expectRevealedPoints(question.points, question.points);
  await phoneB.expectRevealedPoints(question.points, question.points);

  // 2. The panel offers the showdown to the tied teams; the quiz master types the tiebreaker.
  await expect(
    control.page.getByText(
      `Tied for 1st: ${phoneA.teamName}, ${phoneB.teamName}`,
    ),
  ).toBeVisible();
  await createShowdown(control, TIEBREAKER);

  // 3. The quiz ends on the final leaderboard, which shows the tie. The quiz master hides it and the showdown is on air:
  // the big screen asks the question and every phone is invited to guess.
  await control.advance('ended');
  // Tied teams share one rank, so a single press reveals both.
  await control.revealNextLeaderboardTeam();
  await expectPodiumPlace(display, phoneA.teamName, TIED_POINTS, '1.–2.');
  await expectPodiumPlace(display, phoneB.teamName, TIED_POINTS, '1.–2.');
  await control.pressAdvanceSlot();
  await display.expectText(TIEBREAKER.question);
  const [firstSeat, secondSeat] = await readSeatOrder(display);
  const seatPhones = new Map([
    [phoneA.teamName, phoneA],
    [phoneB.teamName, phoneB],
  ]);
  const firstPhone = seatPhones.get(firstSeat)!;
  const secondPhone = seatPhones.get(secondSeat)!;
  await expectGuessForm(firstPhone);
  await expectGuessForm(secondPhone);
  await snap(display, 'ended', 'showdown-guessing');
  await snap(control, 'ended', 'showdown-guessing');
  await snap(firstPhone, 'ended', 'showdown-guess-form');

  // 4. The first seat guesses; the second still has to. Advance refuses to reveal before every guess is in.
  await submitShowdownGuess(firstPhone, WINNER_GUESS);
  await expectGuessed(control, firstPhone.teamName);
  await snap(firstPhone, 'ended', 'showdown-guess-sent');
  await expectGuessForm(secondPhone);
  await snap(secondPhone, 'ended', 'showdown-guess-form-waiting-turn');
  await control.pressAdvanceSlot();
  await expect(display.page.getByText(WINNER_GUESS.toString())).toHaveCount(0);

  await submitShowdownGuess(secondPhone, LOSER_GUESS);
  await expectGuessed(control, secondPhone.teamName);
  await snap(control, 'ended', 'showdown-all-guessed');

  // 5. Turn by turn: the first seat's guess slams in, then the second's, then the answer and the winner.
  await advanceShowdownTurn(control);
  await expect(
    display.page.getByText(WINNER_GUESS.toString(), { exact: true }),
  ).toBeVisible();
  await expect(
    display.page.getByText(LOSER_GUESS.toString(), { exact: true }),
  ).toHaveCount(0);
  await snap(display, 'ended', 'showdown-first-turn');
  await snap(firstPhone, 'ended', 'showdown-first-turn');
  await snap(control, 'ended', 'showdown-first-turn');

  await advanceShowdownTurn(control);
  await expect(
    display.page.getByText(LOSER_GUESS.toString(), { exact: true }),
  ).toBeVisible();
  await snap(display, 'ended', 'showdown-second-turn');
  await snap(secondPhone, 'ended', 'showdown-second-turn');
  await snap(control, 'ended', 'showdown-second-turn');

  await advanceShowdownTurn(control);
  await expect(
    display.page.getByText(new RegExp(`^ANSWER\\s*${TIEBREAKER.answer}$`)),
  ).toBeVisible();
  await snap(display, 'ended', 'showdown-decided');
  await snap(firstPhone, 'ended', 'showdown-decided');
  await snap(control, 'ended', 'showdown-decided');

  // 6. The final placing: the winner's showdown point puts it first on the leaderboard.
  await control.toggleLeaderboard();
  await control.revealNextLeaderboardTeam();
  await expectPodiumPlace(display, secondPhone.teamName, LOSER_POINTS, '2.');
  await secondPhone.expectOwnStanding(LOSER_POINTS);
  await control.revealNextLeaderboardTeam();
  await expectPodiumPlace(display, firstPhone.teamName, WINNER_POINTS, '1.');
  await firstPhone.expectOwnStanding(WINNER_POINTS);
});
