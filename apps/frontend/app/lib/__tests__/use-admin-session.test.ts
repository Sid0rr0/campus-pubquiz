import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UseAdminGameResult } from '@/app/lib/use-admin-game';
import type { UseAuthResult } from '@/app/lib/use-auth';
import { useAdminSession } from '@/app/lib/use-admin-session';
import {
  adminGameResult,
  adminView,
  authenticatedAuthResult,
  progress,
} from '@/app/control/__tests__/test-utils';

const { mockUseAdminGame, mockUseAuth, searchParamsRef, routerRef } =
  vi.hoisted(() => ({
    mockUseAdminGame: vi.fn(),
    mockUseAuth: vi.fn(),
    searchParamsRef: { current: new URLSearchParams() },
    routerRef: { push: vi.fn(), replace: vi.fn() },
  }));

vi.mock('@/app/lib/use-admin-game', () => ({
  useAdminGame: mockUseAdminGame,
}));
vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => routerRef,
}));

function setUrl(query: string) {
  searchParamsRef.current = new URLSearchParams(query);
}

function setAuth(overrides: Partial<UseAuthResult> = {}) {
  mockUseAuth.mockReturnValue(authenticatedAuthResult(overrides));
}

function connectedTo(joinCode: string, connectionError: string | null = null) {
  return adminGameResult({
    snapshot: adminView({
      progress: progress(),
      joinCode,
    }) as UseAdminGameResult['snapshot'],
    connectionError,
  });
}

describe.each(['/control', '/remote'] as const)(
  'useAdminSession(%s)',
  (route) => {
    beforeEach(() => {
      setUrl('');
      routerRef.push.mockReset();
      routerRef.replace.mockReset();
      mockUseAdminGame.mockReset();
      mockUseAuth.mockReset();
      setAuth();
      mockUseAdminGame.mockReturnValue(adminGameResult());
    });

    it('returns the admin game hook result', () => {
      setUrl('code=ABCDEF');
      const game = adminGameResult({ connectionError: 'lost' });
      mockUseAdminGame.mockReturnValue(game);

      const { result } = renderHook(() => useAdminSession(route));

      expect(result.current).toMatchObject(game);
    });

    it('redirects to /login when unauthenticated', async () => {
      setAuth({ status: 'unauthenticated', user: null });
      renderHook(() => useAdminSession(route));

      await waitFor(() =>
        expect(routerRef.replace).toHaveBeenCalledWith('/login'),
      );
    });

    it('redirects to /login when pending approval', async () => {
      setAuth({ status: 'pending' });
      renderHook(() => useAdminSession(route));

      await waitFor(() =>
        expect(routerRef.replace).toHaveBeenCalledWith('/login'),
      );
    });

    it('reports loading while the auth check is running, and never connects', () => {
      setUrl('code=ABCDEF');
      setAuth({ status: 'checking', user: null });

      const { result } = renderHook(() => useAdminSession(route));

      expect(result.current.isLoading).toBe(true);
      expect(mockUseAdminGame).toHaveBeenLastCalledWith(false, 'ABCDEF');
    });

    it('redirects to /sessions when there is no ?code=', async () => {
      const { result } = renderHook(() => useAdminSession(route));

      await waitFor(() =>
        expect(routerRef.replace).toHaveBeenCalledWith('/sessions'),
      );
      expect(result.current.isLoading).toBe(true);
    });

    it('does not connect until a session code is known', () => {
      renderHook(() => useAdminSession(route));

      expect(mockUseAdminGame).toHaveBeenLastCalledWith(false, undefined);
    });

    it('connects for the session code in the URL', () => {
      setUrl('code=ABCDEF');
      const { result } = renderHook(() => useAdminSession(route));

      expect(mockUseAdminGame).toHaveBeenLastCalledWith(true, 'ABCDEF');
      expect(result.current.isLoading).toBe(false);
    });

    it('redirects to /sessions when the socket was refused before any snapshot', async () => {
      setUrl('code=BADCODE');
      mockUseAdminGame.mockReturnValue(
        adminGameResult({ connectionError: 'Unknown game session code' }),
      );
      renderHook(() => useAdminSession(route));

      await waitFor(() =>
        expect(routerRef.replace).toHaveBeenCalledWith('/sessions'),
      );
    });

    it('stays put when a live session reports a connection error', () => {
      setUrl('code=ABCDEF');
      mockUseAdminGame.mockReturnValue(
        connectedTo('ABCDEF', 'Connection lost'),
      );
      renderHook(() => useAdminSession(route));

      expect(routerRef.replace).not.toHaveBeenCalled();
    });

    it("syncs the URL to the connected session on the page's own route", async () => {
      setUrl('code=ABCDEF');
      mockUseAdminGame.mockReturnValue(connectedTo('GHIJKL'));
      renderHook(() => useAdminSession(route));

      await waitFor(() =>
        expect(routerRef.replace).toHaveBeenCalledWith(`${route}?code=GHIJKL`),
      );
    });

    it('does not touch the URL when the snapshot matches the code', () => {
      setUrl('code=ABCDEF');
      mockUseAdminGame.mockReturnValue(connectedTo('ABCDEF'));
      renderHook(() => useAdminSession(route));

      expect(routerRef.replace).not.toHaveBeenCalled();
    });

    it('reconnects when the URL moves to a different session', () => {
      setUrl('code=ABCDEF');
      mockUseAdminGame.mockReturnValue(connectedTo('ABCDEF'));
      const { rerender } = renderHook(() => useAdminSession(route));

      setUrl('code=GHIJKL');
      rerender();

      expect(mockUseAdminGame).toHaveBeenLastCalledWith(true, 'GHIJKL');
    });

    it('does not reconnect when the URL moves to the session already connected', () => {
      setUrl('code=ABCDEF');
      mockUseAdminGame.mockReturnValue(connectedTo('GHIJKL'));
      const { rerender } = renderHook(() => useAdminSession(route));

      setUrl('code=GHIJKL');
      rerender();

      expect(mockUseAdminGame).toHaveBeenLastCalledWith(true, 'ABCDEF');
    });
  },
);
