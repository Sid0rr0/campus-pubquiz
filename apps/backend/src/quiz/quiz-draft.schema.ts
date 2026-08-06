import { z } from 'zod';
import type {
  QuizDraftIssue,
  QuizDraftSaveRequest,
} from '@campus-pubquiz/types';

const httpUrl = z.url({
  protocol: /^https?$/,
  error: 'Media URL must be a valid http(s) URL',
});

const baseQuestionFields = {
  prompt: z.string().min(1, 'Missing question text'),
  answer: z.string().min(1, 'Missing answer'),
  notes: z.string().optional(),
  points: z
    .number('Points must be a positive whole number')
    .int('Points must be a positive whole number')
    .positive('Points must be a positive whole number'),
  answerMediaUrl: httpUrl.optional(),
};

// Mirrors question-row.schema.ts's per-type rules, but validates the
// already-structured ImportQuestionPreview shape (real numbers/arrays) that
// both the manual editor and CSV-preview-to-draft conversion produce,
// instead of raw CSV cell strings.
const questionPreviewSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('free_text'),
    ...baseQuestionFields,
    mediaUrl: httpUrl.optional(),
  }),
  z
    .object({
      type: z.literal('multiple_choice'),
      ...baseQuestionFields,
      options: z
        .array(z.string().min(1))
        .min(2, 'Provide at least two options'),
      mediaUrl: httpUrl.optional(),
    })
    .refine((question) => question.options.includes(question.answer), {
      path: ['answer'],
      error: 'Answer must be one of the options',
    }),
  z.object({
    type: z.literal('picture'),
    ...baseQuestionFields,
    mediaUrl: httpUrl,
  }),
  z.object({
    type: z.literal('audio'),
    ...baseQuestionFields,
    mediaUrl: httpUrl,
  }),
]);

/**
 * Validates a full quiz draft (manual edits and/or a CSV-import preview
 * carried into the editor) before it's persisted. Never throws — every
 * problem becomes a `QuizDraftIssue` the editor UI can point at. `roundIndex:
 * -1` marks a quiz-level issue (missing title, no rounds at all);
 * `questionIndex: null` marks a round-level issue (missing round title, no
 * questions in the round).
 */
export function validateQuizDraft(
  request: QuizDraftSaveRequest,
): QuizDraftIssue[] {
  const issues: QuizDraftIssue[] = [];

  if (request.title.trim() === '') {
    issues.push({
      roundIndex: -1,
      questionIndex: null,
      field: 'title',
      message: 'Missing quiz title',
    });
  }
  if (request.rounds.length === 0) {
    issues.push({
      roundIndex: -1,
      questionIndex: null,
      field: 'rounds',
      message: 'Quiz needs at least one round',
    });
  }

  request.rounds.forEach((round, roundIndex) => {
    if (round.title.trim() === '') {
      issues.push({
        roundIndex,
        questionIndex: null,
        field: 'title',
        message: 'Missing round title',
      });
    }
    if (round.questions.length === 0) {
      issues.push({
        roundIndex,
        questionIndex: null,
        field: 'questions',
        message: 'Round needs at least one question',
      });
    }

    round.questions.forEach((question, questionIndex) => {
      const parsed = questionPreviewSchema.safeParse(question);
      if (parsed.success) return;
      for (const issue of parsed.error.issues) {
        issues.push({
          roundIndex,
          questionIndex,
          field: String(issue.path[0] ?? 'question'),
          message: issue.message,
        });
      }
    });
  });

  return issues;
}
