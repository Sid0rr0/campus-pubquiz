import { z } from 'zod';

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

/** What any stored payload decodes to: every field a type may carry, optional. */
export interface QuestionPayload {
  options?: string[];
  matchTargets?: string[];
  matchScoringMode?: 'partial' | 'all_or_nothing';
  mediaUrl?: string;
  answerMediaUrl?: string;
  mediaStartSeconds?: number;
  mediaEndSeconds?: number;
}
