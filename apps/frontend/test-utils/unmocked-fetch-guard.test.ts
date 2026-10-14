import { afterEach, describe, expect, it } from 'vitest';
import { takeUnmockedRequests } from '@/test-utils/unmocked-fetch-guard';

describe('unmocked fetch guard', () => {
  // The global afterEach fails any spec that left unmocked requests behind;
  // these specs make them on purpose, so drain them first. This afterEach is
  // registered after the setup file's, so it runs before it (Vitest runs
  // afterEach hooks in reverse order).
  afterEach(() => {
    takeUnmockedRequests();
  });

  it('rejects an unmocked fetch with an error naming the method and URL', async () => {
    await expect(
      fetch('http://localhost:3000/api/sessions', { method: 'POST' }),
    ).rejects.toThrow(
      'Unmocked network request: POST http://localhost:3000/api/sessions',
    );
  });

  it('defaults the method to GET and reads the URL from a Request', async () => {
    await expect(
      fetch(new Request('http://localhost:3000/api/quizzes')),
    ).rejects.toThrow(
      'Unmocked network request: GET http://localhost:3000/api/quizzes',
    );
  });
});
