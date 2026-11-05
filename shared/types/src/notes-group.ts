import { SCORING_MODES, type ScoringMode } from './scoring-mode';
import type { Margin } from './margin';
import { formatTimecode, parseTimecode } from './youtube';

/** What a `{…}` group in a question's notes can carry: the clip, the hidden-video flag and the grading settings; each field is present only when the group sets it. */
export interface NotesGroupFields {
  startSeconds?: number;
  endSeconds?: number;
  revealStartSeconds?: number;
  revealEndSeconds?: number;
  isVideoHidden?: true;
  margin?: Margin;
  scoringMode?: ScoringMode;
}

// The pre-rename match names, still read from old sheets.
const LEGACY_SCORING_NAMES = new Map<string, ScoringMode>([
  ['partial', 'per_item'],
  ['all_or_nothing', 'one_off'],
]);

export interface ParsedNotesGroup {
  /** The notes with the clip group (and a legacy `YouTube clip:` prefix) removed. */
  freeNotes: string;
  clip: NotesGroupFields;
  /** The keys (`start`, `revealEnd`, `margin`, `scoring`, …) the group sets to something that doesn't read — as a timecode, a margin or a scoring mode — never silently dropped, so the caller can reject the row. */
  invalidKeys: string[];
}

// A `{…}` group, optionally behind the legacy "YouTube clip:" prefix.
const NOTES_GROUP_PATTERN = /(?:YouTube clip:[ \t]*)?\{([^{}]*)\}/gi;

const TIMECODE_KEYS = [
  ['start', 'startSeconds'],
  ['end', 'endSeconds'],
  ['revealStart', 'revealStartSeconds'],
  ['revealEnd', 'revealEndSeconds'],
] as const;

/** The notes-group keys for the grading settings; `scoring` is the scoring mode of a sort or match question. */
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
  clip: NotesGroupFields;
  invalidKeys: string[];
}

function readSettingValue(body: string, key: string): string | undefined {
  return keyPattern(key, `[^\\s,}"']+`).exec(body)?.[1];
}

/** The `margin` setting, and whether it was set but unreadable. */
function readMargin(body: string): ReadGroup {
  const raw = readSettingValue(body, MARGIN_NOTES_KEY);
  if (raw === undefined) return { clip: {}, invalidKeys: [] };
  const margin = parseMarginCell(raw);
  return margin
    ? { clip: { margin }, invalidKeys: [] }
    : { clip: {}, invalidKeys: [MARGIN_NOTES_KEY] };
}

/** The `scoring` setting (legacy names too), and whether it was set but unreadable. */
function readScoring(body: string): ReadGroup {
  const raw = readSettingValue(body, SCORING_NOTES_KEY)?.toLowerCase();
  if (raw === undefined) return { clip: {}, invalidKeys: [] };
  const scoringMode =
    SCORING_MODES.find((mode) => mode === raw) ?? LEGACY_SCORING_NAMES.get(raw);
  return scoringMode
    ? { clip: { scoringMode }, invalidKeys: [] }
    : { clip: {}, invalidKeys: [SCORING_NOTES_KEY] };
}

function readGroup(body: string): ReadGroup {
  const readings = TIMECODE_KEYS.flatMap(([key, field]) => {
    const raw = readSettingValue(body, key);
    if (raw === undefined) return [];
    const seconds = parseTimecode(raw);
    return [{ key, field, seconds }];
  });
  const isHidden = keyPattern('hideVideo', 'true').test(body);
  const margin = readMargin(body);
  const scoring = readScoring(body);
  return {
    clip: {
      ...Object.fromEntries(
        readings.flatMap(({ field, seconds }) =>
          seconds === undefined ? [] : [[field, seconds]],
        ),
      ),
      ...(isHidden ? { isVideoHidden: true as const } : {}),
      ...margin.clip,
      ...scoring.clip,
    },
    invalidKeys: [
      ...readings.flatMap(({ key, seconds }) =>
        seconds === undefined ? [key] : [],
      ),
      ...margin.invalidKeys,
      ...scoring.invalidKeys,
    ],
  };
}

/**
 * The one reader of the CSV notes group syntax: finds the first `{…}` group
 * anywhere in the notes that sets at least one recognised key (`start`, `end`,
 * `revealStart`, `revealEnd` as timecodes, quoted or not; `hideVideo: true`;
 * `margin` as "5%" or "2"; `scoring` as a scoring mode),
 * and returns those fields with the group removed from the notes. Not strict
 * JSON, since authors write unquoted keys. Notes with no recognised group come
 * back unchanged as free notes.
 */
export function parseNotesGroup(notes: string | undefined): ParsedNotesGroup {
  const text = notes ?? '';
  for (const match of text.matchAll(NOTES_GROUP_PATTERN)) {
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
export function writeNotesGroup(
  freeNotes: string,
  clip: NotesGroupFields,
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
    ...(clip.scoringMode
      ? [`${SCORING_NOTES_KEY}: "${clip.scoringMode}"`]
      : []),
  ];
  if (entries.length === 0) return freeNotes;
  const group = `{${entries.join(', ')}}`;
  return freeNotes ? `${freeNotes}\n${group}` : group;
}

/** What the quiz master reads as a question's notes: the notes without the settings group, or null when nothing is left. */
export function questionNotesOf(
  notes: string | null | undefined,
): string | null {
  const freeNotes = parseNotesGroup(notes ?? undefined).freeNotes.trim();
  return freeNotes === '' ? null : freeNotes;
}
