/**
 * Number questions only: how far an answer may be from the key and still be
 * correct. `percent` is a share of the key's magnitude, `absolute` a plain
 * distance. Both ends count as correct; a value of 0 accepts the exact key
 * only.
 */
export type MarginUnit = 'percent' | 'absolute';

export interface Margin {
  value: number;
  unit: MarginUnit;
}

export const MARGIN_UNITS = ['percent', 'absolute'] as const;

/** The margin a Number question without a stored one gets. */
export const DEFAULT_MARGIN: Margin = { value: 10, unit: 'percent' };

const PERCENT_DIVISOR = 100;

/** The furthest an answer may be from `key` and still be inside `margin`. */
export function allowedDistance(key: number, margin: Margin): number {
  return margin.unit === 'absolute'
    ? margin.value
    : (Math.abs(key) * margin.value) / PERCENT_DIVISOR;
}

const ROUNDING_ERROR_ULPS = 16;

/**
 * Whether `answer` is inside `margin` of `key`, edges included. A few ulps of
 * slack keep an answer exactly on the edge correct despite binary floating
 * point (0.55 - 0.5 is 0.05000000000000004, not 0.05).
 */
export function isWithinMargin(
  key: number,
  answer: number,
  margin: Margin,
): boolean {
  const allowed = allowedDistance(key, margin);
  // A margin of 0 means the exact key only, so it gets no slack.
  const slack =
    allowed > 0
      ? Number.EPSILON *
        ROUNDING_ERROR_ULPS *
        Math.max(Math.abs(key), Math.abs(answer), 1)
      : 0;
  return Math.abs(answer - key) <= allowed + slack;
}

/** Parses a typed number: a non-blank string that reads as a finite number, otherwise null. */
export function parseFiniteNumber(text: string): number | null {
  if (text.trim() === '') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

const DISPLAY_DECIMALS = 2;

/** At most 2 decimal places, trailing zeros dropped. Display only: grading uses the exact range. */
function formatNumber(value: number): string {
  return String(Number(value.toFixed(DISPLAY_DECIMALS)));
}

/** What teams are told about how precise they must be: "within 10%", "within 5". */
export function formatMarginText(margin: Margin): string {
  const suffix = margin.unit === 'percent' ? '%' : '';
  return `within ${formatNumber(margin.value)}${suffix}`;
}

/** The accepted range as "low–high", or the single value when the margin is 0. */
export function formatAcceptedRange(key: number, margin: Margin): string {
  const distance = allowedDistance(key, margin);
  const low = formatNumber(key - distance);
  const high = formatNumber(key + distance);
  return low === high ? low : `${low}–${high}`;
}

/** The reveal line: the key followed by the accepted range, e.g. "200 · 180–220 accepted". */
export function formatNumberReveal(answer: string, margin: Margin): string {
  const key = parseFiniteNumber(answer);
  if (key === null) return answer;
  const range = formatAcceptedRange(key, margin);
  return range === formatNumber(key)
    ? range
    : `${formatNumber(key)} · ${range} accepted`;
}
