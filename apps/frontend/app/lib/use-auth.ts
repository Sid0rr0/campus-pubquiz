'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AuthUser } from '@campus-pubquiz/types';
import {
  AuthApiError,
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
} from '@/app/lib/auth-api';

export type AuthStatus = 'checking' | 'unauthenticated' | 'pending' | 'authenticated';

export interface UseAuthResult {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof AuthApiError ? error.message : fallback;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchMe(controller.signal)
      .then((response) => {
        setUser(response.user);
        setStatus('authenticated');
      })
      .catch(() => {
        // Aborted because the component unmounted (route change while the
        // session cookie check was in flight) — the component no longer
        // cares about the result, so don't touch its state.
        if (controller.signal.aborted) return;
        setStatus('unauthenticated');
      });

    return () => controller.abort();
  }, []);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<void> => {
    setError(null);
    try {
      const response = await apiLogin(username, password);
      setUser(response.user);
      setStatus('authenticated');
    } catch (loginError) {
      setError(apiErrorMessage(loginError, 'Login failed'));
      throw loginError;
    }
  }, []);

  const register = useCallback(async (username: string, password: string): Promise<void> => {
    setError(null);
    try {
      await apiRegister(username, password);
      setStatus('pending');
    } catch (registerError) {
      setError(apiErrorMessage(registerError, 'Registration failed'));
      throw registerError;
    }
  }, []);

  const logout = useCallback((): void => {
    // Best-effort server-side revoke — client state is cleared either way,
    // so a failed/expired-token revoke shouldn't surface as an unhandled
    // promise rejection.
    apiLogout().catch(() => {});
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  return { user, status, error, login, register, logout, clearError };
}
