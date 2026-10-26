import { z } from 'zod';
import { MARGIN_UNITS } from './margin';
import { MATCH_SCORING_MODES, SCORING_MODES } from './scoring-mode';
import type { MergedOptional } from './merged-shape';

/**
 * Payload codecs: one Zod schema per question type over the JSON stored in
 * `questions.payload`. They check shape, not business rules (the preview
 * schemas own those, including which lists a type requires), so any row that
 * was ever saved loads. Keys a type
 * doesn't read are dropped — notably any correct answer an old import left
 * in the payload, which must never reach a QuestionView.
 */

const stringList = z.array(z.string()).optional();

const media = {
  mediaUrl: z.string().optional(),
  answerMediaUrl: z.string().optional(),
  // Quiz save derives clip times from any video mediaUrl, whatever the type.
  mediaStartSeconds: z.number().optional(),
  mediaEndSeconds: z.number().optional(),
  // Absent in payloads saved before hidden video existed: reads as not hidden.
  isVideoHidden: z.boolean().optional(),
  // The reveal clip: any question whose media or answer media is a video.
  revealStartSeconds: z.number().optional(),
  revealEndSeconds: z.number().optional(),
};

export const freeTextPayloadSchema = z.object(media);

export const multipleChoicePayloadSchema = z.object({
  ...media,
  options: stringList,
});

export const sortPayloadSchema = z.object({
  ...media,
  options: stringList,
  scoringMode: z.enum(SCORING_MODES).optional(),
});

export const matchPayloadSchema = z.object({
  ...media,
  options: stringList,
  matchTargets: stringList,
  scoringMode: z.enum(MATCH_SCORING_MODES).optional(),
});

export const closestGuessPayloadSchema = z.object(media);

export const numberPayloadSchema = z.object({
  ...media,
  margin: z
    .object({ value: z.number(), unit: z.enum(MARGIN_UNITS) })
    .optional(),
});

/**
 * What any stored payload decodes to: every field a type may carry, optional.
 * Inferred from the per-type schemas above, so a field added to one reaches
 * the type without a second edit.
 */
export type QuestionPayload = MergedOptional<
  | z.infer<typeof freeTextPayloadSchema>
  | z.infer<typeof multipleChoicePayloadSchema>
  | z.infer<typeof sortPayloadSchema>
  | z.infer<typeof matchPayloadSchema>
  | z.infer<typeof closestGuessPayloadSchema>
  | z.infer<typeof numberPayloadSchema>
>;
