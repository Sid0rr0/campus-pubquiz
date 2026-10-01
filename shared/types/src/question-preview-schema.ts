import { z } from 'zod';
import { isSameMultiset, splitPipeList } from './sort-match';
import { extractYoutubeVideoId } from './youtube';

/**
 * Draft-path validation: one Zod schema per question type over the
 * already-structured ImportQuestionPreview shape (real numbers/arrays) that
 * both the manual editor and CSV-preview-to-draft conversion produce, instead
 * of raw CSV cell strings. This is the one schema per type: import decodes a
 * sheet row into this shape (`decodeSheetRow`) and validates with it too.
 */

const hasNoRepeats = (items: string[]) => {
  const normalized = items.map((item) => item.trim());
  return new Set(normalized).size === normalized.length;
};

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
  .refine((question) => hasNoRepeats(question.options), {
    path: ['options'],
    error: 'Options must not repeat',
  });

// An empty list (a blank CSV cell, an editor with no choices typed) means "no
// choices", so the question stays free-typed.
const optionalChoices = z.preprocess(
  (value) => (Array.isArray(value) && value.length === 0 ? undefined : value),
  z.array(z.string().min(1)).min(2, 'Provide at least two options').optional(),
);

/** The `multiple_choice` rules, applied only when the question carries choices. */
function withOptionalChoiceRules<
  T extends z.ZodType<{ options?: string[]; answer: string }>,
>(schema: T) {
  return schema
    .refine(
      (question) =>
        question.options === undefined ||
        question.options.includes(question.answer),
      { path: ['answer'], error: 'Answer must be one of the options' },
    )
    .refine(
      (question) =>
        question.options === undefined || hasNoRepeats(question.options),
      { path: ['options'], error: 'Options must not repeat' },
    );
}

export const audioPreviewSchema = withOptionalChoiceRules(
  z.object({
    type: z.literal('audio'),
    ...baseQuestionFields,
    options: optionalChoices,
    mediaUrl: httpUrl,
  }),
);

export const youtubePreviewSchema = withOptionalChoiceRules(
  z.object({
    type: z.literal('youtube'),
    ...baseQuestionFields,
    options: optionalChoices,
    mediaUrl: httpUrl.refine(
      (url) => extractYoutubeVideoId(url) !== undefined,
      {
        error: 'Media URL must be a youtube.com/youtu.be link for type youtube',
      },
    ),
  }),
);

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
  .superRefine((question, context) => {
    // Answer is only checkable against a clean left list, so a repeat is
    // reported alone rather than alongside a knock-on answer issue.
    if (!hasNoRepeats(question.options)) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Left items must not repeat',
      });
      return;
    }
    const isAnswerPairing =
      hasNoRepeats(question.matchTargets) &&
      isSameMultiset(question.matchTargets, splitPipeList(question.answer));
    if (!isAnswerPairing) {
      context.addIssue({
        code: 'custom',
        path: ['answer'],
        message: 'Answer must pair every right item to a left item, one each',
      });
    }
  });
