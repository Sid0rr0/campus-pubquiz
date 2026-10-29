import {
  ConflictException,
  NotFoundException,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { QuizLiveEditBlockedError } from '@/quiz/live-edit-guard';
import { toQuizHttpError } from '@/quiz/quiz-http-errors';
import {
  QuizDraftInvalidError,
  QuizNotFoundError,
  QuizStaleSaveError,
} from '@/quiz/quiz.service';

const ISSUES = [{ message: 'nope' }] as never;

describe('toQuizHttpError', () => {
  it('maps an invalid draft to 422 with its issues', () => {
    const error = toQuizHttpError(new QuizDraftInvalidError(ISSUES));

    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect((error as UnprocessableEntityException).getResponse()).toMatchObject(
      { issues: ISSUES },
    );
  });

  it('maps a live-edit refusal to 409 with its issues', () => {
    const error = toQuizHttpError(new QuizLiveEditBlockedError(ISSUES));

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      issues: ISSUES,
    });
  });

  it('maps a save from an out-of-date copy to 412 with its message', () => {
    const error = toQuizHttpError(new QuizStaleSaveError(7));

    expect(error).toBeInstanceOf(PreconditionFailedException);
    expect(error.message).toMatch(/changed by someone else/);
  });

  it('maps an unknown quiz to 404', () => {
    expect(toQuizHttpError(new QuizNotFoundError(7))).toBeInstanceOf(
      NotFoundException,
    );
  });

  it('passes other errors through', () => {
    const boom = new Error('boom');

    expect(toQuizHttpError(boom)).toBe(boom);
    expect(toQuizHttpError('text')).toBeInstanceOf(Error);
  });
});
