import { z } from 'zod';
import { DEFAULT_MARGIN, MARGIN_UNITS, parseFiniteNumber } from './margin';
import { MATCH_SCORING_MODES } from './match-scoring-mode';
import type { MergedOptional } from './merged-shape';
import { isSameMultiset, splitPipeList } from './sort-match';

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

const clipSeconds = z
  .number('Clip times must be whole seconds')
  .int('Clip times must be whole seconds')
  .nonnegative('Clip times must not be negative');

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
  // A clip applies to any video (YouTube or file) mediaUrl, whatever the type (the save ignores it for other media).
  mediaStartSeconds: clipSeconds.optional(),
  mediaEndSeconds: clipSeconds.optional(),
  // Covers a video on the big screen while the question is asked (sound only).
  isVideoHidden: z.boolean().optional(),
  revealStartSeconds: clipSeconds.optional(),
  revealEndSeconds: clipSeconds.optional(),
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

/** An answer key that is a finite number — closest guess and Number share it. */
const numberAnswer = z
  .string()
  .refine((value) => parseFiniteNumber(value) !== null, {
    error: 'Answer must be a number',
  });

export const closestGuessPreviewSchema = z.object({
  type: z.literal('closest_guess'),
  ...baseQuestionFields,
  answer: numberAnswer,
  mediaUrl: httpUrl.optional(),
});

const MAX_PERCENT_MARGIN = 100;

const marginSchema = z
  .object({
    value: z
      .number('Margin must be a number')
      .min(0, 'Margin must not be negative'),
    unit: z.enum(MARGIN_UNITS),
  })
  .refine(
    (margin) => margin.unit !== 'percent' || margin.value <= MAX_PERCENT_MARGIN,
    { path: ['value'], error: 'A percentage margin must be at most 100' },
  );

export const numberPreviewSchema = z.object({
  type: z.literal('number'),
  ...baseQuestionFields,
  answer: numberAnswer,
  margin: marginSchema.default(DEFAULT_MARGIN),
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
    matchScoringMode: z.enum(MATCH_SCORING_MODES).optional(),
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

/**
 * Every field any question type's preview may carry, taken from the schemas'
 * input shape (never their output, which could carry defaults filled in by
 * validation). `questionId` is the persisted `Question.id`, absent for CSV
 * import previews and brand-new questions; distinct from the editor's own
 * `EditorQuestion.id`. The always-present fields stay required, the rest are
 * optional: unset margin / match scoring mode are resolved by the Answer key,
 * never defaulted by readers.
 */
type PreviewInput =
  | z.input<typeof freeTextPreviewSchema>
  | z.input<typeof multipleChoicePreviewSchema>
  | z.input<typeof closestGuessPreviewSchema>
  | z.input<typeof numberPreviewSchema>
  | z.input<typeof sortPreviewSchema>
  | z.input<typeof matchPreviewSchema>;

export type ImportQuestionPreview = MergedOptional<PreviewInput> &
  Pick<PreviewInput, 'type' | 'prompt' | 'answer' | 'points'>;
