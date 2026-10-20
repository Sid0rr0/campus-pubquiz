const YOUTUBE_ID_PATTERN =
  /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i;

/** Extracts the 11-character video id from a youtube.com/youtu.be URL, or undefined if the URL isn't YouTube. */
export function extractYoutubeVideoId(url: string): string | undefined {
  return YOUTUBE_ID_PATTERN.exec(url)?.[1];
}

const SECONDS_PER_MINUTE = 60;
const MAX_TIMECODE_PARTS = 3;

/** Parses "SS", "M:SS", or "H:MM:SS" into total seconds, or undefined if unparseable. */
export function parseTimecode(raw: string): number | undefined {
  const parts = raw.trim().split(':');
  if (
    parts.length > MAX_TIMECODE_PARTS ||
    parts.some((part) => !/^\d+$/.test(part))
  ) {
    return undefined;
  }
  return parts.reduceRight(
    (total, part, index) =>
      total + Number(part) * SECONDS_PER_MINUTE ** (parts.length - 1 - index),
    0,
  );
}

/** Writes seconds as "SS" under a minute, "M:SS" under an hour, else "H:MM:SS" — the shapes `parseTimecode` reads. */
export function formatTimecode(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / SECONDS_PER_MINUTE ** 2);
  const minutes = Math.floor(
    (totalSeconds % SECONDS_PER_MINUTE ** 2) / SECONDS_PER_MINUTE,
  );
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  const twoDigits = (value: number) => String(value).padStart(2, '0');
  if (hours > 0) return `${hours}:${twoDigits(minutes)}:${twoDigits(seconds)}`;
  if (minutes > 0) return `${minutes}:${twoDigits(seconds)}`;
  return String(seconds);
}
