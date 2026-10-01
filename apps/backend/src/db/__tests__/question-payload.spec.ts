import { Logger } from '@nestjs/common';
import { readQuestionPayload } from '@/db/question-payload';

describe('readQuestionPayload', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns the decoded payload for a valid row', () => {
    const payload = readQuestionPayload({
      id: 7,
      type: 'sort',
      payload: { options: ['b', 'a'] },
    });

    expect(payload).toEqual({ options: ['b', 'a'] });
  });

  it('logs an error naming the question and rethrows for a malformed row', () => {
    const logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    expect(() =>
      readQuestionPayload({ id: 42, type: 'match', payload: { options: 1 } }),
    ).toThrow(/match payload is malformed/);

    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('Question 42'),
      expect.any(String),
    );
  });
});
