import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { expect, test as base } from '../fixtures';
import {
  ADMIN_STORAGE_STATE,
  E2E_LOCK_GRACE_SECONDS,
  PATHS,
} from '../support/env';
import { seedCsvSession } from '../support/csv-session';
import { expectPodiumStep, expectStandingsRow } from '../support/night-moves';
import type { ControlScreen } from '../support/screens/control-screen';

// joker-night.csv: Warm-up and Music share the first block, Sport is the second.
const CSV = path.join(PATHS.e2eRoot, 'fixtures', 'joker-night.csv');
const warmUp = { prompt: 'What is the capital of France?', key: 'Paris' };
const music = {
  prompt: 'Which band recorded Bohemian Rhapsody?',
  key: 'Queen',
};
const sport = { prompt: 'Which sport uses a shuttlecock?', key: 'Badminton' };
const WARM_UP_POINTS = 2;
const MUSIC_POINTS = 3;
const SPORT_POINTS = 2;

// Team A is right everywhere. Team B misses the capital (graded 0 by hand), gets the band and skips sport.
const TEAM_A_AFTER_BLOCK_ONE = WARM_UP_POINTS + MUSIC_POINTS;
const TEAM_B_AFTER_BLOCK_ONE = MUSIC_POINTS;
const TEAM_A_FINAL = TEAM_A_AFTER_BLOCK_ONE + SPORT_POINTS;
const TEAM_B_FINAL = TEAM_B_AFTER_BLOCK_ONE;

const test = base.extend({
  session: async ({ adminApi }, use) => {
    const quizTitle = `Early answers ${randomUUID().slice(0, 6)}`;
    await use(
      await seedCsvSession(adminApi, CSV, quizTitle, {
        lockGraceSeconds: E2E_LOCK_GRACE_SECONDS,
        earlyAnswerReveal: true,
      }),
    );
  },
});

async function previous(
  control: ControlScreen,
  expectedStatus: string,
): Promise<void> {
  await control.page
    .locator('aside')
    .getByRole('button', { name: 'Previous', exact: true })
    .click();
  await control.expectStatus(expectedStatus);
}

test('an early answer reveal night: answers air before the break, the leaderboard follows it, and the last break ends the quiz', async ({
  control,
  display,
  joinPhone,
  session,
  newContext,
}) => {
  const phoneA = await joinPhone('Team A');
  const phoneB = await joinPhone('Team B');
  await control.expectTeams([phoneA.teamName, phoneB.teamName]);
  await control.startQuiz();
  await control.advance('round_intro');

  // The presenter's remote, to read the "next" line while grading is pending.
  const remoteContext = await newContext({
    storageState: ADMIN_STORAGE_STATE,
  });
  const remote = await remoteContext.newPage();
  await remote.goto(`/remote?code=${session.joinCode}`);
  const upNext = remote
    .locator('section')
    .filter({ has: remote.getByRole('heading', { name: 'Up next' }) });

  // 1. Block one: two rounds, each one question.
  await control.advance('question_open');
  await phoneA.expectQuestion(warmUp.prompt);
  await phoneA.submitText(warmUp.key);
  await phoneB.submitText('Lyon');
  await control.advance('round_intro');
  await control.advance('question_open');
  await phoneA.expectQuestion(music.prompt);
  await phoneA.submitText(music.key);
  await phoneB.submitText(music.key);

  // 2. The lock goes to the answers title card, not the break.
  await control.advance('locking');
  await control.expectStatus('answers_intro');
  await display.expectText('ANSWERS · ROUND 1');

  // 3. Each question airs with its correct answer; the phone has no verdict or points.
  await control.advance('answers');
  await display.expectRevealedAnswer(warmUp.key);
  await phoneA.expectRevealedAnswer(warmUp.key);
  await phoneB.expectRevealedAnswer('Lyon');
  await phoneB.expectText(`Answer: ${warmUp.key}`);
  await expect(phoneB.page.getByText(/\d+ \/ \d+ points/)).toHaveCount(0);
  await control.advance('answers_intro');
  await display.expectText('ANSWERS · ROUND 2');
  await control.advance('answers');
  await display.expectRevealedAnswer(music.key);
  await phoneA.expectRevealedAnswer(music.key);
  await expect(phoneA.page.getByText(/\d+ \/ \d+ points/)).toHaveCount(0);
  await control.advance('break_intro');
  await display.expectBreak(1);

  // 4. Team B's capital is ungraded: leaving the break is refused until it is graded.
  await expect(upNext).toContainText('Waiting for grading');
  await control.pressAdvanceSlot();
  await control.expectStatus('break_intro');
  await control.selectQuestion('Warm-up', 1);
  await control.grade(phoneB.teamName, '0 points');
  await expect(upNext).not.toContainText('Waiting for grading');

  // 5. The break leads straight to the next round intro with the leaderboard up, and the phones show their verdicts.
  await control.advance('round_intro');
  await phoneA.expectRevealedPoints(WARM_UP_POINTS, WARM_UP_POINTS);
  await phoneA.openQuestion(2, 1);
  await phoneA.expectRevealedPoints(MUSIC_POINTS, MUSIC_POINTS);
  await phoneB.openQuestion(1, 1);
  await phoneB.expectRevealedPoints(0, WARM_UP_POINTS);
  await control.revealNextLeaderboardTeam();
  await expectStandingsRow(display, phoneB.teamName, TEAM_B_AFTER_BLOCK_ONE);
  await control.revealNextLeaderboardTeam();
  await expectStandingsRow(display, phoneA.teamName, TEAM_A_AFTER_BLOCK_ONE);

  // 6. Advancing past the ranks hides the board and uncovers the round intro.
  await control.pressAdvanceSlot();
  await display.expectText('Sport');
  await expect(display.page.getByTestId('leaderboard-rows')).toHaveCount(0);

  // 7. Previous goes back to the break card, then into the last answers question, keeping every grade.
  await previous(control, 'break_intro');
  await previous(control, 'answers');
  await display.expectRevealedAnswer(music.key);

  // 8. Forward again: the break exit opens the leaderboard once more.
  await control.advance('break_intro');
  await control.advance('round_intro');
  await control.revealNextLeaderboardTeam();
  await expectStandingsRow(display, phoneB.teamName, TEAM_B_AFTER_BLOCK_ONE);
  await control.toggleLeaderboard();
  await display.expectText('Sport');

  // 9. The last block: its break goes straight to the final screen.
  await control.advance('question_open');
  await phoneA.expectQuestion(sport.prompt);
  await phoneA.submitText(sport.key);
  await control.advance('locking');
  await control.expectStatus('answers_intro');
  await control.advance('answers');
  await display.expectRevealedAnswer(sport.key);
  await control.advance('break_intro');
  await control.advance('ended');
  await control.revealNextLeaderboardTeam();
  await expectPodiumStep(display, phoneB.teamName, TEAM_B_FINAL);
  await control.revealNextLeaderboardTeam();
  await expectPodiumStep(display, phoneA.teamName, TEAM_A_FINAL);
});
