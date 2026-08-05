import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  approveUser,
  AuthApiError,
  deactivateUser,
  fetchMe,
  fetchUsers,
  login,
  logout,
  register,
} from '@/app/lib/auth-api';

const originalFetch = global.fetch;

describe('auth-api', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('register', () => {
    it('posts credentials and returns the pending status', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'pending' }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await register('alice', 'hunter2');

      expect(result).toEqual({ status: 'pending' });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/auth/register',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ username: 'alice', password: 'hunter2' }),
        }),
      );
    });

    it('throws AuthApiError with the server message on a 409', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ message: 'Username "alice" is already taken' }),
      }) as unknown as typeof fetch;

      const error = await register('alice', 'hunter2').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AuthApiError);
      expect((error as AuthApiError).status).toBe(409);
    });
  });

  describe('login', () => {
    it('posts credentials and returns the user', async () => {
      const payload = { user: { id: 1, username: 'alice', role: 'admin', status: 'active' } };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      }) as unknown as typeof fetch;

      const result = await login('alice', 'hunter2');

      expect(result).toEqual(payload);
    });

    it('throws AuthApiError on a 401', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid username or password' }),
      }) as unknown as typeof fetch;

      const error = await login('alice', 'wrong').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AuthApiError);
      expect((error as AuthApiError).message).toBe('Invalid username or password');
    });
  });

  describe('logout', () => {
    it('posts with credentials so the session cookie is sent', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      global.fetch = fetchMock as unknown as typeof fetch;

      await logout();

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/auth/logout',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });
  });

  describe('fetchMe', () => {
    it('returns the current user', async () => {
      const payload = { user: { id: 1, username: 'alice', role: 'admin', status: 'active' } };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      }) as unknown as typeof fetch;

      await expect(fetchMe()).resolves.toEqual(payload);
    });
  });

  describe('fetchUsers', () => {
    it('returns the bucketed user list', async () => {
      const payload = { pending: [], active: [], deactivated: [] };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      }) as unknown as typeof fetch;

      await expect(fetchUsers()).resolves.toEqual(payload);
    });
  });

  describe('approveUser', () => {
    it('posts the chosen role', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      global.fetch = fetchMock as unknown as typeof fetch;

      await approveUser(5, 'moderator');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/users/5/approve',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ role: 'moderator' }),
        }),
      );
    });
  });

  describe('deactivateUser', () => {
    it('posts to the deactivate endpoint', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      global.fetch = fetchMock as unknown as typeof fetch;

      await deactivateUser(5);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/users/5/deactivate',
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      );
    });
  });
});
