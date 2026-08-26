import { describe, expect, test } from 'vitest';
import { queryKeys } from '@/app/lib/query-keys';

describe('queryKeys', () => {
  test('sessions.public and sessions.list share the sessions prefix', () => {
    // Arrange / Act
    const publicKey = queryKeys.sessions.public();
    const listKey = queryKeys.sessions.list();

    // Assert
    expect(publicKey[0]).toBe(queryKeys.sessions.all[0]);
    expect(listKey[0]).toBe(queryKeys.sessions.all[0]);
  });

  test('answers is a top-level namespace, not nested under sessions', () => {
    // Arrange / Act
    const answersKey = queryKeys.answers.all;
    const sessionsKey = queryKeys.sessions.all;

    // Assert
    expect(answersKey[0]).not.toBe(sessionsKey[0]);
  });

  test('quizzes.list is JSON-stable for scoped and unscoped calls', () => {
    // Arrange / Act
    const unscoped = queryKeys.quizzes.list();
    const scoped = queryKeys.quizzes.list('ABCD');

    // Assert
    expect(unscoped).toEqual(['quizzes', 'list', null]);
    expect(scoped).toEqual(['quizzes', 'list', 'ABCD']);
  });

  test('quizzes.draft and quizzes.list share the quizzes prefix', () => {
    // Arrange / Act
    const draftKey = queryKeys.quizzes.draft(42);

    // Assert
    expect(draftKey[0]).toBe(queryKeys.quizzes.all[0]);
  });
});
