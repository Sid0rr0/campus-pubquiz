import { describe, expect, test } from 'vitest';
import { apiErrorMessage } from '@/app/lib/api-error-message';

class FakeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'FakeApiError';
  }
}

describe('apiErrorMessage', () => {
  test('returns the message when the error is an instance of the given class', () => {
    // Arrange
    const error = new FakeApiError('Could not load quizzes', 404);

    // Act
    const message = apiErrorMessage(error, FakeApiError, 'fallback');

    // Assert
    expect(message).toBe('Could not load quizzes');
  });

  test('returns the fallback when the error is a plain Error', () => {
    // Arrange
    const error = new Error('network down');

    // Act
    const message = apiErrorMessage(error, FakeApiError, 'fallback');

    // Assert
    expect(message).toBe('fallback');
  });

  test('returns null when there is no error', () => {
    // Arrange
    // Act
    const message = apiErrorMessage(null, FakeApiError, 'fallback');

    // Assert
    expect(message).toBeNull();
  });
});
