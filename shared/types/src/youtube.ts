const YOUTUBE_ID_PATTERN =
  /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i;

/** Extracts the 11-character video id from a youtube.com/youtu.be URL, or undefined if the URL isn't YouTube. */
export function extractYoutubeVideoId(url: string): string | undefined {
  return YOUTUBE_ID_PATTERN.exec(url)?.[1];
}

/** Parses "SS", "M:SS", or "H:MM:SS" into total seconds, or undefined if unparseable. */
function parseTimecodeToSeconds(raw: string): number | undefined {
  const parts = raw.trim().split(':');
  if (parts.length === 0 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
    return undefined;
  }
  return parts.reduceRight((total, part, index) => total + Number(part) * 60 ** (parts.length - 1 - index), 0);
}

/**
 * Best-effort extraction of a YouTube clip range from a question's free-text
 * `notes`, e.g. `{start: "1:22", end: "2:20"}`. Not strict JSON — authors
 * write unquoted keys, so this is regex-based rather than JSON.parse, and
 * silently ignores notes that don't match rather than erroring (notes stays
 * a free-text field for anything else an author wants to jot down).
 */
export function parseYoutubeClipFromNotes(
  notes: string | undefined,
): { startSeconds?: number; endSeconds?: number } | undefined {
  if (!notes) return undefined;

  const startMatch = /start\s*[:=]\s*["']?(\d{1,2}(?::\d{1,2}){0,2})["']?/i.exec(notes);
  const endMatch = /end\s*[:=]\s*["']?(\d{1,2}(?::\d{1,2}){0,2})["']?/i.exec(notes);

  const startSeconds = startMatch ? parseTimecodeToSeconds(startMatch[1]) : undefined;
  const endSeconds = endMatch ? parseTimecodeToSeconds(endMatch[1]) : undefined;

  if (startSeconds === undefined && endSeconds === undefined) return undefined;
  return {
    ...(startSeconds !== undefined ? { startSeconds } : {}),
    ...(endSeconds !== undefined ? { endSeconds } : {}),
  };
}
