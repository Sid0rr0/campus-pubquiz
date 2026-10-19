/**
 * Media without the network. Every browser context the fixtures open serves
 * the media URLs a quiz CSV may use (`https://example.invalid/<name>.mp3`,
 * `.mp4`, `.png`, and `youtube.com/embed/*`) from small in-memory stand-ins.
 * The bytes are built here rather than read from files so nothing binary has
 * to be committed.
 */
import type { BrowserContext, Route } from '@playwright/test';

const SILENT_MP3_FRAME_COUNT = 40;
/** An MPEG-1 Layer III frame at 128 kbit/s, 44.1 kHz, no padding: 417 bytes, 26 ms of silence. */
const MP3_FRAME_HEADER = [0xff, 0xfb, 0x90, 0x00];
const MP3_FRAME_BYTES = 417;

const SILENT_MP3 = Buffer.concat(
  Array.from({ length: SILENT_MP3_FRAME_COUNT }, () =>
    Buffer.concat([
      Buffer.from(MP3_FRAME_HEADER),
      Buffer.alloc(MP3_FRAME_BYTES - MP3_FRAME_HEADER.length),
    ]),
  ),
);

/** Just the `ftyp` box of an MP4 file: enough for the player element to take the URL, not to decode. */
const STUB_MP4 = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00,
  0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x31,
]);

/** A 1x1 transparent PNG. */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const BLANK_EMBED_HTML = '<!doctype html><title>stub</title><body></body>';

const EXAMPLE_HOST_URL = /^https:\/\/example\.invalid\//;
const YOUTUBE_EMBED_URL =
  /^https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\//;
const RANGE_HEADER = /^bytes=(\d*)-(\d*)$/;

interface MediaFile {
  body: Buffer;
  contentType: string;
}

function mediaFileFor(url: string): MediaFile | null {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith('.mp3'))
    return { body: SILENT_MP3, contentType: 'audio/mpeg' };
  if (pathname.endsWith('.mp4'))
    return { body: STUB_MP4, contentType: 'video/mp4' };
  if (/\.(png|jpe?g|gif|webp)$/.test(pathname))
    return { body: PIXEL_PNG, contentType: 'image/png' };
  return null;
}

/** Media elements ask for byte ranges; answer them so seeking and replay behave. */
async function fulfillMedia(
  route: Route,
  { body, contentType }: MediaFile,
): Promise<void> {
  const range = RANGE_HEADER.exec(route.request().headers()['range'] ?? '');
  const headers = {
    'accept-ranges': 'bytes',
    'access-control-allow-origin': '*',
  };
  if (!range) {
    await route.fulfill({ status: 200, contentType, headers, body });
    return;
  }
  const start = range[1] ? Number(range[1]) : 0;
  const end = Math.min(
    range[2] ? Number(range[2]) : body.length - 1,
    body.length - 1,
  );
  await route.fulfill({
    status: 206,
    contentType,
    headers: {
      ...headers,
      'content-range': `bytes ${start}-${end}/${body.length}`,
    },
    body: body.subarray(start, end + 1),
  });
}

/** Serves the media stand-ins to every page of the context. */
export async function stubMedia(context: BrowserContext): Promise<void> {
  await context.route(YOUTUBE_EMBED_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: BLANK_EMBED_HTML,
    }),
  );
  await context.route(EXAMPLE_HOST_URL, (route) => {
    const file = mediaFileFor(route.request().url());
    return file
      ? fulfillMedia(route, file)
      : route.fulfill({ status: 404, body: 'no such e2e media fixture' });
  });
}
