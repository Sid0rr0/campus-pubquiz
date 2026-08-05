import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError } from '@/app/lib/auth-api';
import { useAuth } from '@/app/lib/use-auth';

const { mockFetchMe, mockLogin, mockRegister, mockLogout } = vi.hoisted(() => ({
  mockFetchMe: vi.fn(),
  mockLogin: vi.fn(),
  mockRegister: vi.fn(),
  mockLogout: vi.fn(),
}));

vi.mock('@/app/lib/auth-api', async () => {
  const actual = await vi.importActual<typeof import('@/app/lib/auth-api')>('@/app/lib/auth-api');
  return {
    ...actual,
    fetchMe: mockFetchMe,
    login: mockLogin,
    register: mockRegister,
    logout: mockLogout,
  };
});

const authUser = { id: 1, username: 'alice', role: 'admin' as const, status: 'active' as const };

describe('useAuth', () => {
  beforeEach(() => {
    mockFetchMe.mockReset();
    mockLogin.mockReset();
    mockRegister.mockReset();
    mockLogout.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts unauthenticated when there is no valid session cookie', async () => {
    mockFetchMe.mockRejectedValue(new AuthApiError('Missing or invalid session cookie', 401));

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.user).toBeNull();
  });

  it('rehydrates from a valid session cookie by calling /auth/me', async () => {
    mockFetchMe.mockResolvedValue({ user: authUser });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user).toEqual(authUser);
  });

  it('login moves to authenticated', async () => {
    mockFetchMe.mockRejectedValue(new AuthApiError('Missing or invalid session cookie', 401));
    mockLogin.mockResolvedValue({ user: authUser });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await act(async () => {
      await result.current.login('alice', 'hunter2');
    });

    expect(result.current.status).toBe('authenticated');
    expect(result.current.user).toEqual(authUser);
  });

  it('login surfaces the AuthApiError message without throwing to the caller silently swallowed', async () => {
    mockFetchMe.mockRejectedValue(new AuthApiError('Missing or invalid session cookie', 401));
    mockLogin.mockRejectedValue(new AuthApiError('Invalid username or password', 401));
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await act(async () => {
      await expect(result.current.login('alice', 'wrong')).rejects.toThrow();
    });

    expect(result.current.error).toBe('Invalid username or password');
    expect(result.current.status).toBe('unauthenticated');
  });

  it('clearError resets the error field', async () => {
    mockFetchMe.mockRejectedValue(new AuthApiError('Missing or invalid session cookie', 401));
    mockLogin.mockRejectedValue(new AuthApiError('Invalid username or password', 401));
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await act(async () => {
      await expect(result.current.login('alice', 'wrong')).rejects.toThrow();
    });
    expect(result.current.error).toBe('Invalid username or password');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('register moves to pending status on success', async () => {
    mockFetchMe.mockRejectedValue(new AuthApiError('Missing or invalid session cookie', 401));
    mockRegister.mockResolvedValue({ status: 'pending' });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    await act(async () => {
      await result.current.register('alice', 'hunter2');
    });

    expect(result.current.status).toBe('pending');
  });

  it('logout clears local state and revokes the server-side session', async () => {
    mockFetchMe.mockResolvedValue({ user: authUser });
    mockLogout.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    act(() => {
      result.current.logout();
    });

    expect(mockLogout).toHaveBeenCalledWith();
    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
  });

  it('logout does not throw when the server-side revoke fails', async () => {
    mockFetchMe.mockResolvedValue({ user: authUser });
    mockLogout.mockRejectedValue(new AuthApiError('Invalid or expired session', 401));
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    act(() => {
      result.current.logout();
    });

    expect(result.current.status).toBe('unauthenticated');
  });
});
