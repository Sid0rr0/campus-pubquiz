import {
  MATCH_SCORING_MODES,
  type MatchScoringMode,
} from './match-scoring-mode';
import type { Margin } from './margin';

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

/** What a `{…}` group in a question's notes can carry: the clip, the hidden-video flag and the grading settings; each field is present only when the group sets it. */
export interface ClipNotesFields {
  startSeconds?: number;
  endSeconds?: number;
  revealStartSeconds?: number;
  revealEndSeconds?: number;
  isVideoHidden?: true;
  margin?: Margin;
  matchScoringMode?: MatchScoringMode;
}

export interface ParsedClipNotes {
  /** The notes with the clip group (and a legacy `YouTube clip:` prefix) removed. */
  freeNotes: string;
  clip: ClipNotesFields;
  /** The keys (`start`, `revealEnd`, `margin`, `scoring`, …) the group sets to something that doesn't read — as a timecode, a margin or a scoring mode — never silently dropped, so the caller can reject the row. */
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

/** The notes-group keys for the grading settings; `scoring` is the match scoring mode. */
export const MARGIN_NOTES_KEY = 'margin';
export const SCORING_NOTES_KEY = 'scoring';

const MARGIN_CELL_PATTERN = /^(\d+(?:\.\d+)?)(%?)$/;

/** Reads "5%" as a percent margin and "2" or "0.5" as an absolute one; undefined for anything else. Range limits are the question schema's. */
export function parseMarginCell(raw: string): Margin | undefined {
  const match = MARGIN_CELL_PATTERN.exec(raw.trim());
  if (!match) return undefined;
  return {
    value: Number(match[1]),
    unit: match[2] === '%' ? 'percent' : 'absolute',
  };
}

/** Writes a margin in the shape `parseMarginCell` reads: "5%" for percent, "2" for absolute. */
export function formatMarginCell(margin: Margin): string {
  return margin.unit === 'percent' ? `${margin.value}%` : String(margin.value);
}

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
  const rawMargin = keyPattern(MARGIN_NOTES_KEY, `[^\\s,}"']+`).exec(body)?.[1];
  const margin =
    rawMargin === undefined ? undefined : parseMarginCell(rawMargin);
  const rawScoring = keyPattern(SCORING_NOTES_KEY, `[^\\s,}"']+`)
    .exec(body)?.[1]
    ?.toLowerCase();
  const matchScoringMode = MATCH_SCORING_MODES.find(
    (mode) => mode === rawScoring,
  );
  const invalidSettingKeys = [
    ...(rawMargin !== undefined && margin === undefined
      ? [MARGIN_NOTES_KEY]
      : []),
    ...(rawScoring !== undefined && matchScoringMode === undefined
      ? [SCORING_NOTES_KEY]
      : []),
  ];
  return {
    clip: {
      ...Object.fromEntries(
        readings.flatMap(({ field, seconds }) =>
          seconds === undefined ? [] : [[field, seconds]],
        ),
      ),
      ...(isHidden ? { isVideoHidden: true as const } : {}),
      ...(margin ? { margin } : {}),
      ...(matchScoringMode ? { matchScoringMode } : {}),
    },
    invalidKeys: [
      ...readings.flatMap(({ key, seconds }) =>
        seconds === undefined ? [key] : [],
      ),
      ...invalidSettingKeys,
    ],
  };
}

/**
 * The one reader of the CSV notes group syntax: finds the first `{…}` group
 * anywhere in the notes that sets at least one recognised key (`start`, `end`,
 * `revealStart`, `revealEnd` as timecodes, quoted or not; `hideVideo: true`;
 * `margin` as "5%" or "2"; `scoring` as a match scoring mode),
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

/** Appends the fields as one canonical group, e.g. `{start: "55", end: "1:28", margin: "5%"}`, leaving empty keys out; with no fields the free notes come back unchanged. */
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
    ...(clip.margin
      ? [`${MARGIN_NOTES_KEY}: "${formatMarginCell(clip.margin)}"`]
      : []),
    ...(clip.matchScoringMode
      ? [`${SCORING_NOTES_KEY}: "${clip.matchScoringMode}"`]
      : []),
  ];
  if (entries.length === 0) return freeNotes;
  const group = `{${entries.join(', ')}}`;
  return freeNotes ? `${freeNotes}\n${group}` : group;
}
