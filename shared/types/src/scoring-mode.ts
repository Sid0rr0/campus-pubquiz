/**
 * How Scoring's scoreSubmission scores a part-right answer (the **Scoring
 * mode** of GLOSSARY.md):
 * - `exact`: full points only for the exact answer.
 * - `per_item`: the points shared out over the items (or pairs) right, rounded
 *   (see scoring.ts).
 * - `one_off`: half points when exactly one mistake, otherwise zero.
 *
 * The one declaration of the values and of which ones each type accepts:
 * schemas, the payload and the question views all take them from here.
 */
export const EXACT_SCORING = 'exact';
export const PER_ITEM_SCORING = 'per_item';
export const ONE_OFF_SCORING = 'one_off';

export const SCORING_MODES = [
  EXACT_SCORING,
  PER_ITEM_SCORING,
  ONE_OFF_SCORING,
] as const;

export type ScoringMode = (typeof SCORING_MODES)[number];

/** Match accepts `per_item` (its default) and `one_off`; sort accepts all three. */
export const MATCH_SCORING_MODES = [PER_ITEM_SCORING, ONE_OFF_SCORING] as const;
