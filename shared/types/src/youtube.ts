const YOUTUBE_ID_PATTERN =
  /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i;

/** Extracts the 11-character video id from a youtube.com/youtu.be URL, or undefined if the URL isn't YouTube. */
export function extractYoutubeVideoId(url: string): string | undefined {
  return YOUTUBE_ID_PATTERN.exec(url)?.[1];
}

/** Whether the URL is a YouTube link (the only media a clip applies to). */
export function isYoutubeUrl(url: string | undefined): boolean {
  return url !== undefined && extractYoutubeVideoId(url) !== undefined;
}

/** Whether the question's own media or its answer media is a YouTube link — the questions that carry a reveal clip. */
export function hasYoutubeMedia(media: {
  mediaUrl?: string;
  answerMediaUrl?: string;
}): boolean {
  return isYoutubeUrl(media.mediaUrl) || isYoutubeUrl(media.answerMediaUrl);
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

/** What a `{…}` group in a question's notes can carry; each field is present only when the group sets it. */
export interface ClipNotesFields {
  startSeconds?: number;
  endSeconds?: number;
  revealStartSeconds?: number;
  revealEndSeconds?: number;
  isVideoHidden?: true;
}

export interface ParsedClipNotes {
  /** The notes with the clip group (and a legacy `YouTube clip:` prefix) removed. */
  freeNotes: string;
  clip: ClipNotesFields;
  /** The timecode keys (`start`, `revealEnd`, …) the group sets to something that doesn't read as a timecode — never silently dropped, so the caller can reject the row. */
  invalidKeys: string[];
}

// A `{…}` group, optionally behind the legacy "YouTube clip:" prefix.
const CLIP_GROUP_PATTERN = /(?:YouTube clip:[ \t]*)?\{([^{}]*)\}/gi;

const TIMECODE_KEYS = [
  ['start', 'startSeconds'],
  ['end', 'endSeconds'],
  ['revealStart', 'revealStartSeconds'],
  ['revealEnd', 'revealEndSeconds'],
] as const;

// The lookbehind keeps `start` from matching inside `revealStart`.
function keyPattern(key: string, valuePattern: string): RegExp {
  return new RegExp(
    `(?<![A-Za-z])${key}\\s*[:=]\\s*["']?(${valuePattern})["']?`,
    'i',
  );
}

interface ReadGroup {
  clip: ClipNotesFields;
  invalidKeys: string[];
}

function readGroup(body: string): ReadGroup {
  const readings = TIMECODE_KEYS.flatMap(([key, field]) => {
    const raw = keyPattern(key, `[^\\s,}"']+`).exec(body)?.[1];
    if (raw === undefined) return [];
    const seconds = parseTimecode(raw);
    return [{ key, field, seconds }];
  });
  const isHidden = keyPattern('hideVideo', 'true').test(body);
  return {
    clip: {
      ...Object.fromEntries(
        readings.flatMap(({ field, seconds }) =>
          seconds === undefined ? [] : [[field, seconds]],
        ),
      ),
      ...(isHidden ? { isVideoHidden: true as const } : {}),
    },
    invalidKeys: readings.flatMap(({ key, seconds }) =>
      seconds === undefined ? [key] : [],
    ),
  };
}

/**
 * The one reader of the CSV notes clip syntax: finds the first `{…}` group
 * anywhere in the notes that sets at least one recognised key (`start`, `end`,
 * `revealStart`, `revealEnd` as timecodes, quoted or not; `hideVideo: true`),
 * and returns those fields with the group removed from the notes. Not strict
 * JSON, since authors write unquoted keys. Notes with no recognised group come
 * back unchanged as free notes.
 */
export function parseClipNotes(notes: string | undefined): ParsedClipNotes {
  const text = notes ?? '';
  for (const match of text.matchAll(CLIP_GROUP_PATTERN)) {
    const { clip, invalidKeys } = readGroup(match[1]);
    if (Object.keys(clip).length === 0 && invalidKeys.length === 0) continue;
    const before = text.slice(0, match.index).trimEnd();
    const after = text.slice(match.index + match[0].length).trimStart();
    const freeNotes = [before, after].filter(Boolean).join('\n');
    return { freeNotes, clip, invalidKeys };
  }
  return { freeNotes: text, clip: {}, invalidKeys: [] };
}

/** Appends the clip as one canonical group, e.g. `{start: "55", end: "1:28"}`, leaving empty keys out; with no clip the free notes come back unchanged. */
export function writeClipNotes(
  freeNotes: string,
  clip: ClipNotesFields,
): string {
  const entries = [
    ...TIMECODE_KEYS.flatMap(([key, field]) => {
      const seconds = clip[field];
      return seconds === undefined
        ? []
        : [`${key}: "${formatTimecode(seconds)}"`];
    }),
    ...(clip.isVideoHidden ? ['hideVideo: true'] : []),
  ];
  if (entries.length === 0) return freeNotes;
  const group = `{${entries.join(', ')}}`;
  return freeNotes ? `${freeNotes}\n${group}` : group;
}
