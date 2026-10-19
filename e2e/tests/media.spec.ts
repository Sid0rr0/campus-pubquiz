import { randomUUID } from 'node:crypto';
import { createSession } from '../support/api';
import { serveDecodableVideo } from '../support/decodable-video';
import {
  enterFullscreenMedia,
  exitFullscreenMedia,
  expectNoPauseButton,
  expectPaused,
  expectPlayedPast,
  expectPlaying,
  expectRewoundBelow,
  fullscreenPlayer,
  pauseMedia,
  player,
  replayMedia,
  resumeMedia,
} from '../support/media-controls';
import { importMediaNight, MEDIA_NIGHT } from '../support/media-night';
import { expect, test as base } from '../fixtures';

const test = base.extend({
  // Every journey here plays the media quiz instead of the quiz-night one.
  session: async ({ adminApi, sessionSettings }, use) => {
    const quizTitle = `Media night ${randomUUID().slice(0, 6)}`;
    const quizId = await importMediaNight(adminApi, quizTitle);
    const joinCode = await createSession(
      adminApi,
      quizId,
      quizTitle,
      sessionSettings,
    );
    await use({ joinCode, quizId, quizTitle });
  },
});

const { image, audio, video, youtube, hiddenVideo, answerVideo } = MEDIA_NIGHT;

/** How far into the 1-5 s clip the video has to play before replay has something to rewind. */
const REWIND_FROM_SECONDS = video.clipStartSeconds + 1;

test('each kind of media gets its player, the controls drive it, and the reveal plays the right clip', async ({
  control,
  display,
  joinPhone,
}) => {
  const phone = await joinPhone('Team A');
  await serveDecodableVideo(display.page.context(), display.page);
  await control.startQuiz();
  await control.advance('round_intro');

  // 1. An image: shown as an image, nothing to pause, replay or hide.
  await control.advance('question_open');
  await display.expectQuestion(image.prompt);
  await expect(player(display, 'question-image')).toHaveAttribute(
    'src',
    image.mediaUrl,
  );
  await phone.expectText('👀 Look at the screen');
  await expectNoPauseButton(control);

  // 2. A sound: an audio player that the quiz master can pause and resume.
  await control.advance('question_open');
  await display.expectQuestion(audio.prompt);
  await display.expectAudioPlayer(audio.mediaUrl);
  await display.expectAudioLoaded();
  await expectPlaying(player(display, 'question-audio'));
  await pauseMedia(control);
  await expectPaused(player(display, 'question-audio'));
  await resumeMedia(control);
  await expectPlaying(player(display, 'question-audio'));

  // 3. A video file: carries its clip as a fragment; pause, replay and fullscreen change the display.
  await control.advance('question_open');
  await display.expectQuestion(video.prompt);
  const questionVideo = player(display, 'question-video');
  await expect(questionVideo).toHaveAttribute('src', video.questionSrc);
  await expectPlaying(questionVideo);
  const playedUntil = await expectPlayedPast(
    questionVideo,
    REWIND_FROM_SECONDS,
  );
  await pauseMedia(control);
  await expectPaused(questionVideo);
  await replayMedia(control);
  await expectPlaying(questionVideo);
  await expectRewoundBelow(questionVideo, playedUntil);
  await enterFullscreenMedia(control);
  await expect(fullscreenPlayer(display, 'question-video')).toBeVisible();
  await expectPlaying(questionVideo);
  await exitFullscreenMedia(control);
  await expect(fullscreenPlayer(display, 'question-video')).toHaveCount(0);

  // 4. A YouTube clip: the embed carries the clip as params; replay mounts a fresh player.
  await control.advance('question_open');
  await display.expectQuestion(youtube.prompt);
  const questionEmbed = player(display, 'question-youtube');
  await expect(questionEmbed).toHaveAttribute('src', youtube.questionSrc);
  await questionEmbed.evaluate((embed) => embed.setAttribute('data-e2e', '1'));
  await pauseMedia(control);
  await resumeMedia(control);
  await replayMedia(control);
  await expect(questionEmbed).not.toHaveAttribute('data-e2e', '1');
  await expect(questionEmbed).toHaveAttribute('src', youtube.questionSrc);

  // 5. A hidden video: it keeps playing under a cover, and the phones are told to listen.
  await control.advance('question_open');
  await display.expectQuestion(hiddenVideo.prompt);
  await expect(player(display, 'question-video')).toHaveAttribute(
    'src',
    hiddenVideo.mediaUrl,
  );
  await expect(player(display, 'question-video-cover')).toBeVisible();
  await expectPlaying(player(display, 'question-video'));
  await phone.expectText('🎧 Listen');

  // 6. A question with no media of its own has nothing to pause.
  await control.advance('question_open');
  await display.expectQuestion(answerVideo.prompt);
  await expect(player(display, 'question-video')).toHaveCount(0);
  await expectNoPauseButton(control);

  // 7. The block locks; at the reveal each question shows its answer media.
  await control.advance('locking');
  await control.expectStatus('break_intro');
  await control.advance('reveal_intro');
  await control.advance('reveal');
  await display.expectQuestion(image.prompt);
  await expect(player(display, 'reveal-image')).toHaveAttribute(
    'src',
    image.mediaUrl,
  );

  await control.advance('reveal');
  await display.expectQuestion(audio.prompt);
  await expect(player(display, 'reveal-audio')).toHaveAttribute(
    'src',
    audio.mediaUrl,
  );

  // The question video plays again, clipped by the reveal clip.
  await control.advance('reveal');
  await display.expectQuestion(video.prompt);
  const revealVideo = player(display, 'reveal-video');
  await expect(revealVideo).toHaveAttribute('src', video.revealSrc);
  await expectPlaying(revealVideo);

  await control.advance('reveal');
  await display.expectQuestion(youtube.prompt);
  await expect(player(display, 'reveal-youtube')).toHaveAttribute(
    'src',
    youtube.revealSrc,
  );

  // The cover comes off at the reveal; the player is the same hidden video.
  await control.advance('reveal');
  await display.expectQuestion(hiddenVideo.prompt);
  await expect(player(display, 'reveal-video')).toHaveAttribute(
    'src',
    hiddenVideo.mediaUrl,
  );
  await expect(player(display, 'reveal-video-cover')).toHaveCount(0);

  // A video answer replaces the (absent) question media and plays its reveal clip.
  await control.advance('reveal');
  await display.expectQuestion(answerVideo.prompt);
  const revealAnswer = player(display, 'reveal-answer-video');
  await expect(revealAnswer).toHaveAttribute('src', answerVideo.answerSrc);
  await expectPlaying(revealAnswer);
});
