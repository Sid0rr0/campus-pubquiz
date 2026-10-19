/**
 * The media controls of /control (Pause, Resume, Play again, Fullscreen) and
 * what they do to the player on /display. Each action records its move for the
 * coverage registry.
 */
import { expect, type Locator } from '@playwright/test';
import { recordMove } from './coverage';
import type { ControlScreen } from './screens/control-screen';
import type { DisplayScreen } from './screens/display-screen';

interface PlayerState {
  isPaused: boolean;
  currentTime: number;
}

type TestId =
  | 'question-video'
  | 'question-audio'
  | 'question-youtube'
  | 'question-image'
  | 'question-video-cover'
  | 'reveal-video'
  | 'reveal-answer-video'
  | 'reveal-youtube'
  | 'reveal-image'
  | 'reveal-audio'
  | 'reveal-video-cover';

export function player(display: DisplayScreen, testId: TestId): Locator {
  return display.page.getByTestId(testId);
}

/** The element sits inside the full-viewport overlay that Fullscreen media raises. */
export function fullscreenPlayer(
  display: DisplayScreen,
  testId: TestId,
): Locator {
  return display.page.locator('.fixed.inset-0').getByTestId(testId);
}

function mediaButton(control: ControlScreen, name: string): Locator {
  return control.page
    .locator('aside')
    .getByRole('button', { name, exact: true });
}

/** The media row (Pause, Play again) is offered only for an open question whose media can be paused or replayed. */
export async function expectNoPauseButton(
  control: ControlScreen,
): Promise<void> {
  await expect(mediaButton(control, 'Pause')).toHaveCount(0);
  await expect(mediaButton(control, 'Resume')).toHaveCount(0);
}

export async function pauseMedia(control: ControlScreen): Promise<void> {
  await mediaButton(control, 'Pause').click();
  await expect(mediaButton(control, 'Resume')).toBeVisible();
  recordMove('media_pause');
}

export async function resumeMedia(control: ControlScreen): Promise<void> {
  await mediaButton(control, 'Resume').click();
  await expect(mediaButton(control, 'Pause')).toBeVisible();
}

export async function replayMedia(control: ControlScreen): Promise<void> {
  await mediaButton(control, 'Play video again').click();
  recordMove('media_replay');
}

export async function enterFullscreenMedia(
  control: ControlScreen,
): Promise<void> {
  await mediaButton(control, 'Fullscreen media').click();
  await expect(mediaButton(control, 'Exit fullscreen media')).toBeVisible();
  recordMove('media_fullscreen');
}

export async function exitFullscreenMedia(
  control: ControlScreen,
): Promise<void> {
  await mediaButton(control, 'Exit fullscreen media').click();
  await expect(mediaButton(control, 'Fullscreen media')).toBeVisible();
}

function readPlayer(element: Locator): Promise<PlayerState> {
  return element.evaluate((media: HTMLMediaElement) => ({
    isPaused: media.paused,
    currentTime: media.currentTime,
  }));
}

/** The `<video>` or `<audio>` element is playing (not paused, no load error). */
export async function expectPlaying(element: Locator): Promise<void> {
  await expect
    .poll(async () => (await readPlayer(element)).isPaused)
    .toBe(false);
}

export async function expectPaused(element: Locator): Promise<void> {
  await expect
    .poll(async () => (await readPlayer(element)).isPaused)
    .toBe(true);
}

/** Resolves once the element's playback position has passed `seconds`. */
export async function expectPlayedPast(
  element: Locator,
  seconds: number,
): Promise<number> {
  let position = 0;
  await expect
    .poll(async () => {
      position = (await readPlayer(element)).currentTime;
      return position;
    })
    .toBeGreaterThanOrEqual(seconds);
  return position;
}

/** The element's playback position has gone back below `seconds` (it was sought back to the clip start). */
export async function expectRewoundBelow(
  element: Locator,
  seconds: number,
): Promise<void> {
  await expect
    .poll(async () => (await readPlayer(element)).currentTime)
    .toBeLessThan(seconds);
}
