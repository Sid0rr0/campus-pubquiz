import { extractYoutubeVideoId } from './youtube';

/** Largest image the quiz editor may upload — enforced by the backend, pre-checked by the frontend. */
export const MAX_MEDIA_UPLOAD_BYTES = 5 * 1024 * 1024;

const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|ogg|m4a)(\?.*)?$/i;
const VIDEO_FILE_EXTENSION_PATTERN = /\.(mp4|webm|mov|m4v)(\?.*)?$/i;
const HTTP_URL_PATTERN = /^https?:\/\//i;

/**
 * Whether `url` is an http(s) link. Media links come from an admin-imported
 * spreadsheet, not a trusted author — anything else (data:/blob:) could bloat
 * or hang the shared display, so every consumer checks this first.
 */
export function isHttpUrl(url: string): boolean {
  return HTTP_URL_PATTERN.test(url);
}

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
  if (url === undefined || !isHttpUrl(url)) return undefined;
  if (extractYoutubeVideoId(url) !== undefined) return 'youtube';
  if (VIDEO_FILE_EXTENSION_PATTERN.test(url)) return 'video-file';
  if (AUDIO_EXTENSION_PATTERN.test(url)) return 'audio';
  return 'image';
}

/** Whether the link is a video — a YouTube link or a video file. Clip, reveal clip and hidden video apply to exactly these. */
export function isVideoUrl(url: string | undefined): boolean {
  const kind = classifyMediaUrl(url);
  return kind === 'youtube' || kind === 'video-file';
}

/** Whether `url` is media /display can pause and replay (video or audio) — what those buttons gate on. Images have no playback. */
export function isPausableMediaUrl(url: string | undefined): boolean {
  const kind = classifyMediaUrl(url);
  return kind !== undefined && kind !== 'image';
}

/** Whether the question's own media or its answer media is a video — the questions that carry a reveal clip. */
export function hasVideoMedia(media: {
  mediaUrl?: string;
  answerMediaUrl?: string;
}): boolean {
  return isVideoUrl(media.mediaUrl) || isVideoUrl(media.answerMediaUrl);
}

/** Whether a reveal plays the question's own video: no answer media, or an answer link to that same video (same YouTube id, or same file link). */
export function revealPlaysQuestionVideo(media: {
  mediaUrl?: string;
  answerMediaUrl?: string;
}): boolean {
  const { mediaUrl, answerMediaUrl } = media;
  if (mediaUrl === undefined || !isVideoUrl(mediaUrl)) return false;
  if (!answerMediaUrl) return true;
  return (
    (extractYoutubeVideoId(answerMediaUrl) ?? answerMediaUrl) ===
    (extractYoutubeVideoId(mediaUrl) ?? mediaUrl)
  );
}

/** The part of the video to play at reveal: the reveal clip when either time is set, else the question clip when the reveal plays that same video. An empty result means the whole video. */
export function resolveRevealClip(question: {
  mediaUrl?: string;
  answerMediaUrl?: string;
  mediaStartSeconds?: number;
  mediaEndSeconds?: number;
  revealStartSeconds?: number;
  revealEndSeconds?: number;
}): { start?: number; end?: number } {
  const { revealStartSeconds: start, revealEndSeconds: end } = question;
  return start === undefined &&
    end === undefined &&
    revealPlaysQuestionVideo(question)
    ? { start: question.mediaStartSeconds, end: question.mediaEndSeconds }
    : { start, end };
}

export interface MediaUploadResult {
  /** Public, direct link to the stored image — safe to drop into `mediaUrl`/`answerMediaUrl`. */
  url: string;
}
