/** Largest image the quiz editor may upload — enforced by the backend, pre-checked by the frontend. */
export const MAX_MEDIA_UPLOAD_BYTES = 5 * 1024 * 1024;

import { extractYoutubeVideoId } from './youtube';

const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|ogg|m4a)(\?.*)?$/i;
const VIDEO_FILE_EXTENSION_PATTERN = /\.(mp4|webm|mov|m4v)(\?.*)?$/i;
const HTTP_URL_PATTERN = /^https?:\/\//i;

/** What a media link is drawn as: a YouTube embed, a `<video>` file, an `<audio>` file, or (anything else over http(s)) an image. */
export type MediaKind = 'image' | 'audio' | 'youtube' | 'video-file';

/**
 * The one inference of a media link's kind. Neither `mediaUrl` nor
 * `answerMediaUrl` is tied to the question's type, so the kind follows from
 * the link itself. Returns undefined for anything that isn't http(s): links
 * come from an admin-imported spreadsheet, so a data:/blob: payload must never
 * reach the shared display.
 */
export function classifyMediaUrl(
  url: string | undefined,
): MediaKind | undefined {
  if (url === undefined || !HTTP_URL_PATTERN.test(url)) return undefined;
  if (extractYoutubeVideoId(url) !== undefined) return 'youtube';
  if (VIDEO_FILE_EXTENSION_PATTERN.test(url)) return 'video-file';
  if (AUDIO_EXTENSION_PATTERN.test(url)) return 'audio';
  return 'image';
}

/** Whether the link is a video — a YouTube link or a video file. Clip, reveal clip, hidden video, pause, replay and fullscreen apply to exactly these. */
export function isVideoUrl(url: string | undefined): boolean {
  const kind = classifyMediaUrl(url);
  return kind === 'youtube' || kind === 'video-file';
}

export interface MediaUploadResult {
  /** Public, direct link to the stored image — safe to drop into `mediaUrl`/`answerMediaUrl`. */
  url: string;
}
