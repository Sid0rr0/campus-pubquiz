import { expect, test } from '../fixtures';
import { endQuiz } from '../support/admin-pages';
import {
  expectRoundRating,
  findPlayedSessionId,
  rateRound,
  sendFeedback,
} from '../support/feedback';
import { QUIZ_NIGHT } from '../support/quiz-night';
import { snap } from '../support/snapshots';

const { roundOneTitle, roundTwoTitle } = QUIZ_NIGHT;
const COMMENT = 'More music rounds please';

test('teams rate the rounds and suggest topics on their phones, and the quiz master sees them on the stats page', async ({
  control,
  display,
  joinPhone,
  adminApi,
  session,
}) => {
  const phoneA = await joinPhone('Team A');
  const phoneB = await joinPhone('Team B');

  // 1. Play the block (nobody answers) up to the break.
  await control.startQuiz();
  await control.advance('round_intro');
  await control.advance('question_open');
  await control.advance('question_open');
  await control.advance('round_intro');
  await control.advance('question_open');
  await control.advance('locking');
  await control.expectStatus('break_intro');

  // 2. The big screen invites the room to rate; each phone offers both rounds of the block.
  await display.expectBreak(1);
  await display.expectText('Rate the rounds on your phone ★');
  await snap(display, 'break_intro');
  await rateRound(phoneA, roundOneTitle, 4);
  await rateRound(phoneA, roundTwoTitle, 5);
  await rateRound(phoneB, roundOneTitle, 3);
  await snap(phoneA, 'break_intro');

  // 3. The quiz ends: the big screen thanks the room and asks again; the phones offer the final form with the break ratings kept.
  await endQuiz(control);
  await display.expectText('Quiz complete!');
  await display.expectText('Rate the rounds and help us make the quiz better');
  await snap(display, 'ended');
  await phoneA.expectText('Quiz complete!');
  await expectRoundRating(phoneA, roundOneTitle, 4);
  await expectRoundRating(phoneA, roundTwoTitle, 5);
  await expectRoundRating(phoneB, roundOneTitle, 3);

  // 4. Team B rates the second round now; both teams send their suggestions.
  await rateRound(phoneB, roundTwoTitle, 3);
  await sendFeedback(phoneA, COMMENT, ['Geography', 'Film']);
  await sendFeedback(phoneB, 'Loved it', ['Geography']);
  await snap(phoneA, 'ended');

  // 5. The quiz master opens the session's stats: averages, comments and topic counts, all anonymous.
  const gameSessionId = await findPlayedSessionId(adminApi, session.joinCode);
  await control.page.goto(`/stats/${gameSessionId}`);
  const rounds = control.page.getByRole('table').filter({
    has: control.page.getByRole('columnheader', { name: 'Rating' }),
  });
  await expect(
    rounds.getByRole('row').filter({ hasText: roundOneTitle }),
  ).toContainText('★ 3.5 · 2 teams');
  await expect(
    rounds.getByRole('row').filter({ hasText: roundTwoTitle }),
  ).toContainText('★ 4.0 · 2 teams');
  const comments = control.page.getByRole('list', { name: 'Comments' });
  await expect(comments).toContainText(COMMENT);
  await expect(comments).toContainText('Loved it');
  const topics = control.page.getByRole('list', { name: 'Topic suggestions' });
  await expect(topics.getByRole('listitem')).toHaveText([
    'Geography ×2',
    'Film ×1',
  ]);
});
