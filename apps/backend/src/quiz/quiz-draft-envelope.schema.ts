import { z } from 'zod';
import type { QuizDraftSaveRequest } from '@campus-pubquiz/types';

/**
 * The outer shape of a quiz save body, checked at the HTTP boundary: just
 * enough that `validateQuizDraft` can read the title, the rounds and each
 * round's questions without crashing on a missing or mistyped one. The rules
 * for every field inside (and the per-field issues the editor points at) stay
 * in `validateQuizDraft`.
 */
const envelopeSchema = z.object({
  title: z.string(),
  loadedUpdatedAt: z.string().optional(),
  rounds: z.array(
    z.looseObject({
      title: z.string(),
      questions: z.array(z.looseObject({})),
    }),
  ),
});

/** The parsed body, or the first reason it is not shaped like a quiz draft. */
export function parseQuizDraftEnvelope(
  body: unknown,
):
  | { success: true; data: QuizDraftSaveRequest }
  | { success: false; message: string } {
  const result = envelopeSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.join('.');
    return {
      success: false,
      message: where
        ? `Not a quiz draft: ${where} — ${issue.message}`
        : 'Not a quiz draft',
    };
  }
  // The loose rounds still carry every field the editor sent; they are checked
  // in full by validateQuizDraft before anything is written.
  return {
    success: true,
    data: result.data as unknown as QuizDraftSaveRequest,
  };
}
