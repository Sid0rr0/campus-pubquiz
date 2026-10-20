/**
 * Match only: how Scoring's scoreSubmission scores a submitted pairing.
 * `partial` (the default) splits `points` evenly across correctly paired
 * items, rounded (see scoring.ts). `all_or_nothing` instead
 * awards full points when every pair is correct, half points (rounded) when
 * exactly one pair is wrong, and zero otherwise.
 *
 * The one declaration of the values: schemas, the payload and the question
 * views all take them from here.
 */
export const PARTIAL_MATCH_SCORING = 'partial';
export const ALL_OR_NOTHING_MATCH_SCORING = 'all_or_nothing';

export const MATCH_SCORING_MODES = [
  PARTIAL_MATCH_SCORING,
  ALL_OR_NOTHING_MATCH_SCORING,
] as const;

export type MatchScoringMode = (typeof MATCH_SCORING_MODES)[number];
