import { z } from 'zod';
import { MARGIN_UNITS, type Margin } from './margin';

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
  // Quiz save derives clip times from any YouTube mediaUrl, whatever the type.
  mediaStartSeconds: z.number().optional(),
  mediaEndSeconds: z.number().optional(),
  // Absent in payloads saved before hidden video existed: reads as not hidden.
  isVideoHidden: z.boolean().optional(),
  // The reveal clip: any question whose media or answer media is YouTube.
  revealStartSeconds: z.number().optional(),
  revealEndSeconds: z.number().optional(),
};

export const freeTextPayloadSchema = z.object(media);

export const multipleChoicePayloadSchema = z.object({
  ...media,
  options: stringList,
});

export const audioPayloadSchema = z.object({ ...media, options: stringList });

export const youtubePayloadSchema = z.object({
  ...media,
  options: stringList,
});

export const sortPayloadSchema = z.object({ ...media, options: stringList });

export const matchPayloadSchema = z.object({
  ...media,
  options: stringList,
  matchTargets: stringList,
  matchScoringMode: z.enum(['partial', 'all_or_nothing']).optional(),
});

export const closestGuessPayloadSchema = z.object(media);

export const numberPayloadSchema = z.object({
  ...media,
  margin: z
    .object({ value: z.number(), unit: z.enum(MARGIN_UNITS) })
    .optional(),
});

/** What any stored payload decodes to: every field a type may carry, optional. */
export interface QuestionPayload {
  options?: string[];
  matchTargets?: string[];
  matchScoringMode?: 'partial' | 'all_or_nothing';
  margin?: Margin;
  mediaUrl?: string;
  answerMediaUrl?: string;
  mediaStartSeconds?: number;
  mediaEndSeconds?: number;
  isVideoHidden?: boolean;
  revealStartSeconds?: number;
  revealEndSeconds?: number;
}
