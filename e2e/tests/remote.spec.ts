import { randomUUID } from 'node:crypto';
import { devices, type Locator } from '@playwright/test';
import { expect, test as base } from '../fixtures';
import { createSession } from '../support/api';
import { ADMIN_STORAGE_STATE } from '../support/env';
import { importRemoteQuiz, REMOTE_QUIZ } from '../support/remote-quiz';
import { RemoteScreen } from '../support/screens/remote-screen';

const { roundTitle, roundNote, plain, audio, youtube } = REMOTE_QUIZ;

const BIG_SCREEN_WIDTH = 1280;
const GRADING_PENDING = 'Waiting for grading';

const test = base.extend<{ remote: RemoteScreen }>({
  // This journey plays its own small quiz instead of the shared quiz night.
  session: async ({ adminApi, sessionSettings }, use) => {
    const quizTitle = `Remote quiz ${randomUUID().slice(0, 6)}`;
    const quizId = await importRemoteQuiz(adminApi, quizTitle);
    const joinCode = await createSession(
      adminApi,
      quizId,
      quizTitle,
      sessionSettings,
    );
    await use({ joinCode, quizId, quizTitle });
  },

  // The presenter's phone: a mobile context logged in as the quiz master.
  remote: async ({ newContext, session }, use) => {
    const context = await newContext({
      ...devices['Pixel 7'],
      storageState: ADMIN_STORAGE_STATE,
    });
    const remote = new RemoteScreen(await context.newPage(), session.joinCode);
    await remote.open();
    await use(remote);
  },
});

// A longer lock countdown than the default, so /remote can be snapshotted while it runs.
test.use({ sessionSettings: { lockGraceSeconds: 3 } });

function isAudioPaused(audioElement: Locator): Promise<boolean> {
  return audioElement.evaluate((element: HTMLAudioElement) => element.paused);
}

test('part of a block is driven from the presenter remote while the big screen follows', async ({
  control,
  display,
  joinPhone,
  remote,
}) => {
  const phone = await joinPhone('Team A');

  // 1. The lobby: nothing to present yet.
  await remote.expectOnDisplay('Lobby');
  await remote.matchSnapshot('lobby');

  // 2. The quiz master starts the quiz; the remote takes over from the rules.
  await control.startQuiz();
  await remote.expectOnDisplay('Rules');
  await display.expectText('No cheating.');
  await remote.matchSnapshot('rules');

  // 3. Advance to the round title card: its note shows on the remote only.
  await remote.advance();
  await remote.expectOnDisplay('Round 1 title');
  await remote.expectNotes(roundNote);
  await display.expectText(roundTitle);
  await remote.matchSnapshot('round_intro');

  // 4. The first question: its host notes and the "next" line are on the remote.
  await remote.advance();
  await remote.expectOnDisplay('R1 Q1');
  await display.expectQuestion(plain.prompt);
  await phone.expectQuestion(plain.prompt);
  await remote.expectNotes(plain.notes);
  await remote.expectUpNext('R1 Q2');
  await remote.expectAnsweredCount(0, 1);
  await phone.submitText('5');
  await remote.expectAnsweredCount(1, 1);
  await remote.matchSnapshot('question_open');

  // 5. The audio question: pause and resume reach the player on the big screen.
  await remote.advance();
  await remote.expectOnDisplay('R1 Q2');
  await display.expectQuestion(audio.prompt);
  await display.expectAudioPlayer(audio.mediaUrl);
  await display.expectAudioLoaded();
  const audioElement = display.page.locator('audio');
  await expect.poll(() => isAudioPaused(audioElement)).toBe(false);
  await remote.matchSnapshot('question_open-audio');
  await remote.pause();
  await expect.poll(() => isAudioPaused(audioElement)).toBe(true);
  await remote.matchSnapshot('question_open-audio-paused');
  await remote.resume();
  await expect.poll(() => isAudioPaused(audioElement)).toBe(false);

  // 6. The YouTube question: replay restarts the player and fullscreen enlarges it.
  await remote.advance();
  await remote.expectOnDisplay('R1 Q3');
  await display.expectQuestion(youtube.prompt);
  const player = display.page.locator('iframe[title="Question video"]');
  await expect(player).toHaveAttribute('src', new RegExp(youtube.videoId));
  await remote.expectUpNext('R1 Q3');
  await remote.matchSnapshot('question_open-video');

  await player.evaluate((element) => element.setAttribute('data-e2e-seen', ''));
  await remote.replay();
  await expect(player).not.toHaveAttribute('data-e2e-seen', '');
  await expect(player).toHaveAttribute('src', new RegExp(youtube.videoId));

  const widthBefore = (await player.boundingBox())?.width ?? 0;
  expect(widthBefore).toBeLessThan(BIG_SCREEN_WIDTH);
  await remote.toggleFullscreen(true);
  await expect
    .poll(async () => (await player.boundingBox())?.width)
    .toBe(BIG_SCREEN_WIDTH);
  await remote.toggleFullscreen(false);
  await expect
    .poll(async () => (await player.boundingBox())?.width)
    .toBeLessThan(BIG_SCREEN_WIDTH);

  // 7. The last question locks the block; the remote says what is on air meanwhile.
  await remote.advance();
  await display.expectLockCountdown();
  await remote.expectOnDisplay('Locking answers');
  await remote.matchSnapshot('locking');
  await control.expectStatus('break_intro');
  await display.expectBreak(1);
  await remote.expectOnDisplay('Break 1');

  // 8. Team A's typed answer is still ungraded, so the "next" line holds the quiz master back.
  await remote.expectUpNext(GRADING_PENDING);
  await remote.matchSnapshot('break_intro');
  await control.selectQuestion(roundTitle, 1);
  await control.grade(phone.teamName, '0 points');
  await remote.expectUpNext(`Round 1 title`);
  await expect(display.page.getByText(GRADING_PENDING)).toHaveCount(0);

  // 9. The reveal: the big screen follows each press.
  await remote.advance();
  await remote.expectOnDisplay('Revealing · Round 1 title');
  await display.expectText('REVEALING ANSWERS');
  await remote.matchSnapshot('reveal_intro');
  await remote.advance();
  await remote.expectOnDisplay('Revealing R1 Q1');
  await display.expectQuestion(plain.prompt);
  await display.expectRevealedAnswer(plain.key);
  await remote.matchSnapshot('reveal');
});
