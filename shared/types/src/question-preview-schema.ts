import { z } from 'zod';
import { isSameMultiset, splitPipeList } from './sort-match';
import { extractYoutubeVideoId } from './youtube';

/**
 * Draft-path validation: one Zod schema per question type over the
 * already-structured ImportQuestionPreview shape (real numbers/arrays) that
 * both the manual editor and CSV-preview-to-draft conversion produce, instead
 * of raw CSV cell strings. Mirrors question-row-schema.ts's per-type rules.
 */

const httpUrl = z.url({
  protocol: /^https?$/,
  error: 'Media URL must be a valid http(s) URL',
});

const baseQuestionFields = {
  questionId: z.number().int().positive().optional(),
  prompt: z.string().min(1, 'Missing question text'),
  answer: z.string().min(1, 'Missing answer'),
  notes: z.string().optional(),
  points: z
    .number('Points must be a positive whole number')
    .int('Points must be a positive whole number')
    .positive('Points must be a positive whole number'),
  answerMediaUrl: httpUrl.optional(),
};

export const freeTextPreviewSchema = z.object({
  type: z.literal('free_text'),
  ...baseQuestionFields,
  mediaUrl: httpUrl.optional(),
});

export const multipleChoicePreviewSchema = z
  .object({
    type: z.literal('multiple_choice'),
    ...baseQuestionFields,
    options: z.array(z.string().min(1)).min(2, 'Provide at least two options'),
    mediaUrl: httpUrl.optional(),
  })
  .refine((question) => question.options.includes(question.answer), {
    path: ['answer'],
    error: 'Answer must be one of the options',
  })
  .refine(
    (question) => {
      const normalized = question.options.map((option) => option.trim());
      return new Set(normalized).size === normalized.length;
    },
    { path: ['options'], error: 'Options must not repeat' },
  );

export const audioPreviewSchema = z.object({
  type: z.literal('audio'),
  ...baseQuestionFields,
  mediaUrl: httpUrl,
});

export const youtubePreviewSchema = z.object({
  type: z.literal('youtube'),
  ...baseQuestionFields,
  mediaUrl: httpUrl.refine((url) => extractYoutubeVideoId(url) !== undefined, {
    error: 'Media URL must be a youtube.com/youtu.be link for type youtube',
  }),
});

export const closestGuessPreviewSchema = z.object({
  type: z.literal('closest_guess'),
  ...baseQuestionFields,
  answer: z
    .string()
    .refine((value) => value !== '' && Number.isFinite(Number(value)), {
      error: 'Answer must be a number',
    }),
  mediaUrl: httpUrl.optional(),
});

export const sortPreviewSchema = z
  .object({
    type: z.literal('sort'),
    ...baseQuestionFields,
    options: z.array(z.string().min(1)).min(2, 'Provide at least two items'),
    mediaUrl: httpUrl.optional(),
  })
  .refine(
    (question) =>
      isSameMultiset(question.options, splitPipeList(question.answer)),
    {
      path: ['answer'],
      error: 'Answer must list every option exactly once, in the correct order',
    },
  );

export const matchPreviewSchema = z
  .object({
    type: z.literal('match'),
    ...baseQuestionFields,
    options: z
      .array(z.string().min(1))
      .min(2, 'Provide at least two left items'),
    matchTargets: z
      .array(z.string().min(1))
      .min(2, 'Provide at least two right items'),
    matchScoringMode: z.enum(['partial', 'all_or_nothing']).optional(),
    mediaUrl: httpUrl.optional(),
  })
  .refine(
    (question) => question.options.length === question.matchTargets.length,
    {
      path: ['matchTargets'],
      error: 'Left and right lists must have the same number of items',
    },
  )
  .refine(
    (question) =>
      isSameMultiset(question.matchTargets, splitPipeList(question.answer)),
    {
      path: ['answer'],
      error: 'Answer must pair every right item to a left item, one each',
    },
  );

export const questionPreviewSchema = z.discriminatedUnion('type', [
  freeTextPreviewSchema,
  multipleChoicePreviewSchema,
  audioPreviewSchema,
  youtubePreviewSchema,
  closestGuessPreviewSchema,
  sortPreviewSchema,
  matchPreviewSchema,
]);
