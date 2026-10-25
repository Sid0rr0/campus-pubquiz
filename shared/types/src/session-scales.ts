import { z } from 'zod';

/** Pacing (see GLOSSARY), in scale order: what "How was the pace?" is answered with. */
export const PACING_VALUES = ['too_slow', 'just_right', 'too_fast'] as const;
export type Pacing = (typeof PACING_VALUES)[number];

/** Felt difficulty (see GLOSSARY), in scale order: what "How hard were the questions?" is answered with. */
export const FELT_DIFFICULTY_VALUES = [
  'too_easy',
  'just_right',
  'too_hard',
] as const;
export type FeltDifficulty = (typeof FELT_DIFFICULTY_VALUES)[number];

/** The two fixed questions of the final form, each with its values in scale order (counts and buttons follow this order). */
export const SESSION_SCALE_VALUES = {
  pacing: PACING_VALUES,
  feltDifficulty: FELT_DIFFICULTY_VALUES,
} as const;

/** Which of the two fixed questions: `pacing` or `feltDifficulty`. */
export type SessionScale = keyof typeof SESSION_SCALE_VALUES;

/** The answers one scale takes. */
export type SessionScaleValue<S extends SessionScale = SessionScale> =
  (typeof SESSION_SCALE_VALUES)[S][number];

/** How many teams gave each answer on one scale, keyed in scale order. */
export type SessionScaleCounts<S extends SessionScale> = Record<
  SessionScaleValue<S>,
  number
>;

/** Each scale's question, as the phone asks it. */
export const SESSION_SCALE_QUESTIONS: Record<SessionScale, string> = {
  pacing: 'How was the pace?',
  feltDifficulty: 'How hard were the questions?',
};

/** Each answer's label, as the phone's buttons show it (lower-case it for a count line). */
export const SESSION_SCALE_VALUE_LABELS: {
  [S in SessionScale]: Record<SessionScaleValue<S>, string>;
} = {
  pacing: {
    too_slow: 'Too slow',
    just_right: 'Just right',
    too_fast: 'Too fast',
  },
  feltDifficulty: {
    too_easy: 'Too easy',
    just_right: 'Just right',
    too_hard: 'Too hard',
  },
};

/** A team's own answers on the final form's two scales; null until it taps one. */
export interface TeamSessionRatingsView {
  pacing: Pacing | null;
  feltDifficulty: FeltDifficulty | null;
}

/** A team answering one of the final form's two scales; the ack says whether it was saved. Replaces its earlier answer on that scale only. */
export type RateSessionPayload =
  | { scale: 'pacing'; value: Pacing }
  | { scale: 'feltDifficulty'; value: FeltDifficulty };

/** The boundary check for `RATE_SESSION`: a known scale with one of its own values. */
export const rateSessionPayloadSchema = z.discriminatedUnion('scale', [
  z.object({ scale: z.literal('pacing'), value: z.enum(PACING_VALUES) }),
  z.object({
    scale: z.literal('feltDifficulty'),
    value: z.enum(FELT_DIFFICULTY_VALUES),
  }),
]);
