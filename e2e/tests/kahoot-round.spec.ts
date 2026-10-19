import { test as base, expect } from '../fixtures';
import {
  expectTimerMove,
  KAHOOT_ROUND,
  seedKahootSession,
  type KahootSessionOptions,
} from '../support/kahoot-session';
import { snap } from '../support/snapshots';

const { first, second } = KAHOOT_ROUND;

/** A correct kahoot answer is scaled by how fast it came, so only its range is checked. */
const POINTS_PATTERN = /^(\d+(\.5)?) \/ 3 points$/;

// Long enough for all three screens to be snapshotted while the lock countdown runs.
const MANUAL_LOCK_GRACE_SECONDS = 4;
const TIMER_SECONDS = 1;

const test = base.extend<{ kahootOptions: KahootSessionOptions }>({
  kahootOptions: [
    { kahootQuestionTimerSeconds: null, lockGraceSeconds: 1 },
    { option: true },
  ],
  session: async ({ adminApi, kahootOptions }, use) => {
    const quizTitle = `Kahoot ${Date.now().toString(36)}`;
    await use(await seedKahootSession(adminApi, quizTitle, kahootOptions));
  },
});

test.describe('questions are locked, scored and revealed one at a time', () => {
  test.use({
    kahootOptions: {
      kahootQuestionTimerSeconds: null,
      lockGraceSeconds: MANUAL_LOCK_GRACE_SECONDS,
    },
  });

  test('each question goes question, locking, reveal before the next opens', async ({
    control,
    display,
    joinPhone,
  }) => {
    const phoneA = await joinPhone('Team A');
    const phoneB = await joinPhone('Team B');
    await control.expectTeams([phoneA.teamName, phoneB.teamName]);
    await control.startQuiz();
    await control.advance('round_intro');
    await display.expectText(KAHOOT_ROUND.title);

    // 1. The first question: Team A is right, Team B is wrong.
    await control.advance('question_open');
    await display.expectQuestion(first.prompt);
    await phoneA.submitChoice(first.right);
    await phoneB.submitChoice(first.wrong);
    await display.expectAnsweredCount(2, 2);
    await snap(display, 'question_open');
    await snap(phoneA, 'question_open');
    await snap(control, 'question_open');

    // 2. It locks on its own, without waiting for the second question, and is revealed.
    await control.advance('locking');
    await display.expectLockCountdown();
    await snap(display, 'locking');
    await snap(phoneA, 'locking');
    await snap(control, 'locking');
    await expectTimerMove(control, 'reveal', 'auto_advance');
    await display.expectQuestion(first.prompt);
    await display.expectRevealedAnswer(first.right);
    await phoneA.expectRevealedAnswer(first.right);
    await expect(phoneA.page.getByText(POINTS_PATTERN)).toBeVisible();
    await phoneB.expectRevealedAnswer(first.wrong);
    await phoneB.expectRevealedPoints(0, first.points);
    await snap(display, 'reveal');
    await snap(phoneA, 'reveal');
    await snap(control, 'reveal');

    // 3. The next question opens behind the standings, and shows once the board is hidden.
    await control.advance('question_open');
    await snap(display, 'question_open', 'behind-leaderboard');
    await snap(phoneA, 'question_open', 'behind-leaderboard');
    await snap(control, 'question_open', 'behind-leaderboard');
    await control.toggleLeaderboard();
    await display.expectQuestion(second.prompt);
    await phoneA.expectQuestion(second.prompt);
    await phoneA.submitChoice(second.right);
    await phoneB.submitChoice(second.wrong);

    // 4. The second question locks and reveals the same way, then the quiz ends.
    await control.advance('locking');
    await expectTimerMove(control, 'reveal', 'auto_advance');
    await display.expectRevealedAnswer(second.right);
    await phoneB.expectRevealedAnswer(second.wrong);
    await phoneB.expectRevealedPoints(0, second.points);
    await control.advance('ended');
  });
});

test.describe('the question timer runs the round by itself', () => {
  test.use({
    kahootOptions: {
      kahootQuestionTimerSeconds: TIMER_SECONDS,
      lockGraceSeconds: 1,
    },
  });

  test('an unanswered question locks and reveals with nobody pressing anything', async ({
    control,
    display,
    joinPhone,
  }) => {
    const phone = await joinPhone('Team A');
    await control.expectTeams([phone.teamName]);
    await control.startQuiz();
    await control.advance('round_intro');

    // The timer starts when the first question opens and ends it after a second.
    await control.pressAdvanceSlot();
    await expectTimerMove(control, 'reveal', 'phase_timer');
    await display.expectQuestion(first.prompt);
    await display.expectRevealedAnswer(first.right);
    await phone.expectRevealedPoints(0, first.points);

    // The second question waits behind the standings; the timer starts when it shows.
    await control.advance('question_open');
    await control.toggleLeaderboard();
    await expectTimerMove(control, 'reveal', 'phase_timer');
    await display.expectRevealedAnswer(second.right);
    await control.advance('ended');
  });
});
