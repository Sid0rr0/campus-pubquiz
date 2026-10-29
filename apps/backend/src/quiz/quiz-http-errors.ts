import {
  ConflictException,
  NotFoundException,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { QuizDraftSaveRequest } from '@campus-pubquiz/types';
import { QuizLiveEditBlockedError } from '@/quiz/live-edit-guard';
import { parseQuizDraftEnvelope } from '@/quiz/quiz-draft-envelope.schema';
import {
  QuizDraftInvalidError,
  QuizNotFoundError,
  QuizStaleSaveError,
} from '@/quiz/quiz.service';

/** Maps the errors a quiz save can throw (also through the Live edit module) to their HTTP form: 422 for a malformed draft, 409 for a live-edit refusal, 412 for a save from an out-of-date copy, 404 for an unknown quiz. Anything else is returned as an Error. */
export function toQuizHttpError(error: unknown): Error {
  if (error instanceof QuizDraftInvalidError) {
    return new UnprocessableEntityException({
      message: error.message,
      issues: error.issues,
    });
  }
  if (error instanceof QuizLiveEditBlockedError) {
    return new ConflictException({
      message: error.message,
      issues: error.issues,
    });
  }
  if (error instanceof QuizStaleSaveError) {
    return new PreconditionFailedException(error.message);
  }
  if (error instanceof QuizNotFoundError) {
    return new NotFoundException(error.message);
  }
  return error instanceof Error ? error : new Error(String(error));
}

/** A save body shaped like a quiz draft, or a 422 saying how it is not; field-level problems are `validateQuizDraft`'s, later. */
export function parseDraftBody(body: unknown): QuizDraftSaveRequest {
  const parsed = parseQuizDraftEnvelope(body);
  if (!parsed.success) {
    throw new UnprocessableEntityException({
      message: parsed.message,
      issues: [],
    });
  }
  return parsed.data;
}
