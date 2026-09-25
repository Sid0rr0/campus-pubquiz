/**
 * Fixed list a round's `category` must come from — driven by the admin
 * editor's `<select>` and enforced server-side (CSV/Sheets import and the
 * manual quiz-draft save), so a round's category is always one of these or
 * unset, never arbitrary free text.
 */
export const ROUND_CATEGORIES = [
  'General knowledge',
  'History',
  'Geography',
  'Science & nature',
  'Sports',
  'Music',
  'Film & TV',
  'Literature & books',
  'Art & culture',
  'News',
  'Food & drink',
  'Other',
] as const;

export type RoundCategory = (typeof ROUND_CATEGORIES)[number];
