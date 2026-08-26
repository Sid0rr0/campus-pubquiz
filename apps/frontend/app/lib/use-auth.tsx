'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser, MeResponse } from '@campus-pubquiz/types';
import {
  AuthApiError,
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
} from '@/app/lib/auth-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';

export type AuthStatus =
  | 'checking'
  | 'unauthenticated'
  | 'pending'
  | 'authenticated';

export interface UseAuthResult {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

interface Credentials {
  username: string;
  password: string;
}

function useAuthState(): UseAuthResult {
  const queryClient = useQueryClient();

  // Registration parks the user on the pending-approval screen. It is not a
  // property of /auth/me (a pending account has no session), and clearError()
  // must be able to drop the inline form error without dropping this screen
  // — so it stays a local flag rather than derived from mutation state.
  const [isAwaitingApproval, setIsAwaitingApproval] = useState(false);

  const meQuery = useQuery<MeResponse | null>({
    queryKey: queryKeys.auth.me(),
    queryFn: ({ signal }) => fetchMe(signal),
    // Any failure — 401, network, 500 — means "not signed in", exactly how
    // the old effect's bare .catch() treated it. Retrying would hold the
    // whole app on "checking" while an expired cookie is re-checked 3 times.
    retry: false,
    // The provider mounts once for the app's lifetime; nothing re-checks the
    // cookie today, so nothing should start doing so now.
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const loginMutation = useMutation({
    mutationFn: ({ username, password }: Credentials) =>
      apiLogin(username, password),
    onSuccess: (response) => {
      setIsAwaitingApproval(false);
      queryClient.setQueryData(queryKeys.auth.me(), { user: response.user });
    },
  });

  const registerMutation = useMutation({
    mutationFn: ({ username, password }: Credentials) =>
      apiRegister(username, password),
    onSuccess: () => setIsAwaitingApproval(true),
  });

  // `() => apiLogout()`, not `apiLogout` directly — React Query calls
  // mutationFn(variables), so passing the function bare would invoke it as
  // apiLogout(undefined) and break the existing
  // `expect(mockLogout).toHaveBeenCalledWith()` assertion.
  const logoutMutation = useMutation({ mutationFn: () => apiLogout() });

  // mutate/mutateAsync/reset are referentially stable in v5; the mutation
  // objects are not, so destructuring keeps the callbacks below stable.
  const { mutateAsync: loginAsync, reset: resetLogin } = loginMutation;
  const { mutateAsync: registerAsync, reset: resetRegister } = registerMutation;
  const { mutate: logoutMutate } = logoutMutation;

  const user = meQuery.data?.user ?? null;

  // Order matters: an authenticated session always wins over a leftover
  // pending flag, and 'checking' only applies before the first /auth/me
  // settles.
  const status: AuthStatus = user
    ? 'authenticated'
    : isAwaitingApproval
      ? 'pending'
      : meQuery.isPending
        ? 'checking'
        : 'unauthenticated';

  // A failed /auth/me deliberately does NOT populate `error` — same as
  // today, where the mount effect never called setError.
  const error =
    apiErrorMessage(loginMutation.error, AuthApiError, 'Login failed') ??
    apiErrorMessage(
      registerMutation.error,
      AuthApiError,
      'Registration failed',
    );

  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      // A stale register error must not outlive a fresh login attempt — the
      // old code's setError(null) cleared both.
      resetRegister();
      await loginAsync({ username, password }); // rethrows, same as before
    },
    [loginAsync, resetRegister],
  );

  const register = useCallback(
    async (username: string, password: string): Promise<void> => {
      resetLogin();
      await registerAsync({ username, password });
    },
    [registerAsync, resetLogin],
  );

  const logout = useCallback((): void => {
    // Best-effort server-side revoke — `mutate` (not `mutateAsync`) never
    // rejects, so a failed/expired-token revoke can't surface as an
    // unhandled promise rejection, matching the old `.catch(() => {})`.
    logoutMutate();
    setIsAwaitingApproval(false);
    queryClient.setQueryData(queryKeys.auth.me(), null);
    // Drop every other cached (now stale, previous-account) query so the
    // next account to sign in without a full page reload can't see the
    // previous one's data. `auth` is excluded so the null we just wrote
    // survives — a bare queryClient.clear() would remove it too and make the
    // mounted observer immediately refetch /auth/me.
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== 'auth',
    });
  }, [logoutMutate, queryClient]);

  const clearError = useCallback((): void => {
    resetLogin();
    resetRegister();
  }, [resetLogin, resetRegister]);

  return { user, status, error, login, register, logout, clearError };
}

// A single provider instance at the app root means every page and the
// header read the same status/user — logging in on /login is immediately
// visible in the header without a refetch, and logging out anywhere clears
// every consumer at once.
const AuthContext = createContext<UseAuthResult | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const auth = useAuthState();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth(): UseAuthResult {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
