/**
 * A video the browser can really play, built in code. The mp4 stand-in of
 * media-stub.ts is only a box header: a `<video>` fires `error` on it and the
 * display then drops the player, so nothing about pause, replay or the hidden
 * cover could be observed. This records a few seconds of canvas animation with
 * MediaRecorder (WebM/VP8, which Chromium decodes) inside a page, and serves
 * those bytes for every `.webm` URL of `https://example.invalid/` in a context.
 */
import type { BrowserContext, Page } from '@playwright/test';
import { fulfillMedia, type MediaFile } from './media-stub';

const CLIP_SECONDS = 8;
const WEBM_URL = /^https:\/\/example\.invalid\/.*\.webm(\?.*)?$/i;

/** One recording per worker process: it takes `CLIP_SECONDS` of real time. */
let recording: Promise<Buffer> | undefined;

async function recordWebm(page: Page, seconds: number): Promise<Buffer> {
  const base64 = await page.evaluate(async (durationSeconds) => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2d canvas');
    const recorder = new MediaRecorder(canvas.captureStream(25), {
      mimeType: 'video/webm;codecs=vp8',
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    let frame = 0;
    const timer = setInterval(() => {
      frame += 1;
      context.fillStyle = `hsl(${(frame * 9) % 360} 70% 50%)`;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }, 40);
    recorder.start(250);
    await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));
    clearInterval(timer);
    recorder.stop();
    await stopped;
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }, seconds);
  return Buffer.from(base64, 'base64');
}

/**
 * Makes every `.webm` URL on example.invalid play in the context's pages.
 * `page` is any open page of a browser (it runs the recorder); call this
 * before the question that shows the video opens.
 */
export async function serveDecodableVideo(
  context: BrowserContext,
  page: Page,
): Promise<void> {
  recording ??= recordWebm(page, CLIP_SECONDS);
  const file: MediaFile = {
    body: await recording,
    contentType: 'video/webm',
  };
  await context.route(WEBM_URL, (route) => fulfillMedia(route, file));
}
