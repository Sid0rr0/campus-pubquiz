import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  closeSession,
  createSession,
  fetchPublicSessions,
  fetchSessions,
  SessionApiError,
  updateSessionSettings,
} from '@/app/lib/sessions-api';

const originalFetch = global.fetch;

describe('sessions-api', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('fetchSessions', () => {
    it('gets /sessions with the session cookie and returns the payload', async () => {
      const payload = [
        {
          joinCode: 'ABCDEF',
          quizId: 1,
          quizTitle: 'Campus Pub Quiz Night',
          status: 'lobby',
          teamCount: 2,
        },
      ];
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await fetchSessions();

      expect(result).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/sessions',
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('throws SessionApiError with the server message when the response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid or expired session' }),
      }) as unknown as typeof fetch;

      const error = await fetchSessions().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(SessionApiError);
      expect((error as SessionApiError).message).toBe(
        'Invalid or expired session',
      );
      expect((error as SessionApiError).status).toBe(401);
    });
  });

  describe('fetchPublicSessions', () => {
    it('gets /sessions/public without credentials and returns the payload', async () => {
      const payload = [
        {
          joinCode: 'ABCDEF',
          quizId: 1,
          quizTitle: 'Campus Pub Quiz Night',
          status: 'lobby',
          teamCount: 2,
        },
      ];
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await fetchPublicSessions();

      expect(result).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/sessions/public',
      );
    });

    it('throws SessionApiError when the response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Something broke' }),
      }) as unknown as typeof fetch;

      const error = await fetchPublicSessions().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(SessionApiError);
      expect((error as SessionApiError).message).toBe('Something broke');
    });
  });

  describe('createSession', () => {
    it('posts /sessions with the quiz id and returns the created session', async () => {
      const payload = {
        joinCode: 'GHIJKL',
        quizId: 2,
        quizTitle: 'Imported Quiz',
        status: 'lobby',
        teamCount: 0,
      };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await createSession(2);

      expect(result).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/sessions',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ quizId: 2 }),
        }),
      );
    });

    it('throws SessionApiError when quizId is rejected', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'quizId is required' }),
      }) as unknown as typeof fetch;

      const error = await createSession(2).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(SessionApiError);
      expect((error as SessionApiError).message).toBe('quizId is required');
      expect((error as SessionApiError).status).toBe(400);
    });

    it('includes a partial settings override in the POST body when given', async () => {
      const payload = {
        joinCode: 'GHIJKL',
        quizId: 2,
        quizTitle: 'Imported Quiz',
        status: 'lobby',
        teamCount: 0,
      };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      await createSession(2, { lockGraceSeconds: 15 });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/sessions',
        expect.objectContaining({
          body: JSON.stringify({
            quizId: 2,
            settings: { lockGraceSeconds: 15 },
          }),
        }),
      );
    });
  });

  describe('updateSessionSettings', () => {
    it('patches /sessions/:joinCode/settings with the session cookie', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = fetchMock as unknown as typeof fetch;

      await updateSessionSettings('ABCDEF', { lockGraceSeconds: 15 });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/sessions/ABCDEF/settings',
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
          body: JSON.stringify({ lockGraceSeconds: 15 }),
        }),
      );
    });

    it('throws SessionApiError when the update is rejected', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ message: 'Session already started' }),
      }) as unknown as typeof fetch;

      const error = await updateSessionSettings('ABCDEF', {
        lockGraceSeconds: 15,
      }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(SessionApiError);
      expect((error as SessionApiError).message).toBe(
        'Session already started',
      );
      expect((error as SessionApiError).status).toBe(409);
    });
  });

  describe('closeSession', () => {
    it('deletes /sessions/:joinCode with the session cookie', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = fetchMock as unknown as typeof fetch;

      await closeSession('ABCDEF');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/sessions/ABCDEF',
        expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
      );
    });

    it('throws SessionApiError when the session cannot be closed', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ message: 'Session is not ended yet' }),
      }) as unknown as typeof fetch;

      const error = await closeSession('ABCDEF').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(SessionApiError);
      expect((error as SessionApiError).message).toBe(
        'Session is not ended yet',
      );
      expect((error as SessionApiError).status).toBe(409);
    });
  });
});
