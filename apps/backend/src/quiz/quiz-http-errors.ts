import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { QuizLiveEditBlockedError } from '@/quiz/live-edit-guard';
import { QuizDraftInvalidError, QuizNotFoundError } from '@/quiz/quiz.service';

/** Maps the errors a quiz save can throw (also through the Live edit module) to their HTTP form: 422 for a malformed draft, 409 for a live-edit refusal, 404 for an unknown quiz. Anything else is returned as an Error. */
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
  if (error instanceof QuizNotFoundError) {
    return new NotFoundException(error.message);
  }
  return error instanceof Error ? error : new Error(String(error));
}
